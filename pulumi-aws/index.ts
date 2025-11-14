import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create a VPC
const vpc = new aws.ec2.Vpc("myVpc", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
});

// Create a public subnet
const publicSubnet = new aws.ec2.Subnet("publicSubnet", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    mapPublicIpOnLaunch: true,
    availabilityZone: "us-east-1a",
});

// Create a private subnet
const privateSubnet = new aws.ec2.Subnet("privateSubnet", {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "us-east-1a",
});

// Create an Internet Gateway
const igw = new aws.ec2.InternetGateway("igw", {
    vpcId: vpc.id,
});

// Create a route table for the public subnet
const publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
    vpcId: vpc.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            gatewayId: igw.id,
        },
    ],
});

// Associate the route table with the public subnet
new aws.ec2.RouteTableAssociation("publicRouteTableAssociation", {
    subnetId: publicSubnet.id,
    routeTableId: publicRouteTable.id,
});

// Create a security group for the EC2 instance
const securityGroup = new aws.ec2.SecurityGroup("securityGroup", {
    vpcId: vpc.id,
    ingress: [
        {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
    egress: [
        {
            protocol: "tcp",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
});

// Create an EC2 instance in the private subnet
const ec2Instance = new aws.ec2.Instance("ec2Instance", {
    ami: "ami-0cae6d6fe6048ca2c", 
    instanceType: "t2.micro",
    subnetId: privateSubnet.id,
    vpcSecurityGroupIds: [securityGroup.id],
    associatePublicIpAddress: false,
});

// Create an S3 bucket for logs
const logBucket = new aws.s3.Bucket("logbucket", {
    acl: "public-read-write",
});

// Create a restricted IAM role
const role = new aws.iam.Role("restrictedRole", {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: {
                    Service: "ec2.amazonaws.com",
                },
            },
        ],
    }),
});

// Attach a policy to the role using pulumi.interpolate to ensure correct ARN formatting
const rolePolicy = new aws.iam.RolePolicy("rolePolicy", {
    role: role.id,
    policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject"
                ],
                "Effect": "Allow",
                "Resource": "${logBucket.arn}/*"
            }
        ]
    }`,
});

// Export the VPC ID and instance public IP
export const vpcId = vpc.id;
export const instanceId = ec2Instance.id;
export const logsBucketName = logBucket.bucket;
export const roleName = role.name;
