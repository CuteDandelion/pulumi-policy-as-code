import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

// Define configuration variables
const environment = "dev";
const eksClusterVersion = "1.32";
const vpcCidr = "10.0.0.0/16";
const nodeGroupName = `${environment}-nodegroup`;
const clusterName = `${environment}-eks`;

// Fetch availability zones
const availabilityZones = aws.getAvailabilityZones({});

// Define tags
const tags = {
    Environment: environment,
    Project: "LLMOps",
};

// Create VPC and subnets
const vpc = new aws.ec2.Vpc(`${environment}-vpc`, {
    cidrBlock: vpcCidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: tags,
});

const publicSubnets: aws.ec2.Subnet[] = [];
const privateSubnets: aws.ec2.Subnet[] = [];
const databaseSubnets: aws.ec2.Subnet[] = [];

for (let i = 0; i < 3; i++) {
    publicSubnets.push(new aws.ec2.Subnet(`${environment}-public-subnet-${i + 1}`, {
        vpcId: vpc.id,
        cidrBlock: `10.0.${i * 2 + 1 + i}.0/24`,
        availabilityZone: availabilityZones.then(zones => zones.names[i]),
        tags: {
            ...tags,
            "kubernetes.io/role/elb": "1",
        },
    }));

    privateSubnets.push(new aws.ec2.Subnet(`${environment}-private-subnet-${i + 1}`, {
        vpcId: vpc.id,
        cidrBlock: `10.0.${i * 2 + 2 + i}.0/24`,
        availabilityZone: availabilityZones.then(zones => zones.names[i]),
        tags: {
            ...tags,
            "kubernetes.io/role/internal-elb": "1",
        },
    }));

    databaseSubnets.push(new aws.ec2.Subnet(`${environment}-database-subnet-${i + 1}`, {
        vpcId: vpc.id,
        cidrBlock: `10.0.${i * 2 + 3 + i}.0/24`,
        availabilityZone: availabilityZones.then(zones => zones.names[i]),
        tags: tags,
    }));
}

// Internet Gateway for public subnets
const igw = new aws.ec2.InternetGateway(`${environment}-igw`, {
    vpcId: vpc.id,
    tags: tags,
});

// Public route table
const publicRouteTable = new aws.ec2.RouteTable(`${environment}-public-rt`, {
    vpcId: vpc.id,
    tags: tags,
});

new aws.ec2.Route(`${environment}-public-route`, {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: igw.id,
});

// Associate public route table with public subnets
const publicRouteTableAssociations = publicSubnets.map((subnet, index) =>
    new aws.ec2.RouteTableAssociation(`${environment}-public-rta-${index}`, {
        subnetId: subnet.id,
        routeTableId: publicRouteTable.id,
    })
);

// EIP and NAT Gateway for private subnets (place in first public subnet)
const eip = new aws.ec2.Eip(`${environment}-nat-eip`, {
    domain: "vpc",
    tags: tags,
});

const nat = new aws.ec2.NatGateway(`${environment}-nat`, {
    allocationId: eip.id,
    subnetId: publicSubnets[0].id,
    tags: tags,
}, { dependsOn: [igw] });

// Private route table
const privateRouteTable = new aws.ec2.RouteTable(`${environment}-private-rt`, {
    vpcId: vpc.id,
    tags: tags,
});

new aws.ec2.Route(`${environment}-private-route`, {
    routeTableId: privateRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    natGatewayId: nat.id,
});

// Associate private route table with private subnets
const privateRouteTableAssociations = privateSubnets.map((subnet, index) =>
    new aws.ec2.RouteTableAssociation(`${environment}-private-rta-${index}`, {
        subnetId: subnet.id,
        routeTableId: privateRouteTable.id,
    })
);

// IAM role and policies for EKS nodes, including Bedrock access
const managedPolicyArns = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    "arn:aws:iam::aws:policy/AmazonBedrockFullAccess", // Bedrock access policy
];

const assumeRolePolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Sid: "",
        Principal: {
            Service: "ec2.amazonaws.com",
        },
    }],
});

const eksNodeRole = new aws.iam.Role(`${environment}-eksnode-role`, {
    assumeRolePolicy: assumeRolePolicy,
    managedPolicyArns: managedPolicyArns,
});

const instanceProfile = new aws.iam.InstanceProfile("instanceProfile", {role: eksNodeRole.name});

// Create EKS cluster
const cluster = new eks.Cluster(clusterName, {
    vpcId: vpc.id,
    privateSubnetIds: privateSubnets.map(subnet => subnet.id),
    publicSubnetIds: publicSubnets.map(subnet => subnet.id),
    version: eksClusterVersion,
    tags: tags,
    clusterSecurityGroupTags: tags,
    skipDefaultNodeGroup: true,
    authenticationMode: eks.AuthenticationMode.Api,
    enabledClusterLogTypes: [
        "api",
        "audit",
        "authenticator",
    ],
}, { dependsOn: [nat, igw] });

// Create EKS Node Group
const nodeGroup = new aws.eks.NodeGroup(`${nodeGroupName}-ng`, {
    clusterName: cluster.eksCluster.name,
    nodeRoleArn: eksNodeRole.arn,
    subnetIds: privateSubnets.map(subnet => subnet.id),
    scalingConfig: {
        desiredSize: 2,
        minSize: 1,
        maxSize: 3,
    },
    instanceTypes: ["m5.large"],
    amiType: "AL2_x86_64",
    diskSize: 20,
   // remoteAccess: {
   //     ec2SshKey: "your-key-name",
   // },
    tags: {
        ...tags,
        "Name": `${nodeGroupName}-ng`,
    },
}, { dependsOn: [cluster] });

// Create ECR repository
const ecrRepo = new aws.ecr.Repository(`${environment}-llmops-repo`, {
    imageTagMutability: "MUTABLE",
    imageScanningConfiguration: {
        scanOnPush: true,
    },
    tags: tags,
});

// Export outputs
export const kubeconfig = cluster.kubeconfig;

// Create a Kubernetes provider instance using the kubeconfig
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig.apply(JSON.stringify),
});

// Install ArgoCD using Helm
const argoCd = new k8s.helm.v3.Chart("argo-cd", {
    chart: "argo-cd",
    version: "8.5.0",
    fetchOpts: { repo: "https://argoproj.github.io/argo-helm" },
    values: {
        server: {
            service: {
                type: "LoadBalancer"
            }
        }
    },
}, { provider: k8sProvider });

export const clusterEndpoint = cluster.eksCluster.endpoint;
export const ecrRepositoryUrl = ecrRepo.repositoryUrl;
