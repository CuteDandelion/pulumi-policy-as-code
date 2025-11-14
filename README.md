# pulumi-policy-as-code
Demonstrate the use of policy-as-code to enforce security controls within AWS via pulumi

# Usage

## Pre-requisites:
1. Install [pulumi](https://www.pulumi.com/docs/get-started/download-install/)
2. Install [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

#Procedures:

Download the repo and do the following:

1. First login with your pulumi personal access token:
   ```
   # pulumi will prompt for personal access token
   pulumi login

   ```

2. reinitialize the pulumi stack :
   ```
   cd pulumi-aws
   pulumi stack init dev

   ```

3. Test working policies during stack planning or preview :
   ```
   pulumi preview --policy-pack ../custom-policy-pack --policy-pack ../aws-compliance-ISO27001

   ```

4. execute stack provisioning (if needed) :
   ```                         
   pulumi up

   ```

# Developing New Custom Policies:

1. Editting index.ts in custom-policy-pack/
   ```                         
   # Define a policy -->

   export const s3BucketPrefixPolicy: ResourceValidationPolicy = {
       // The name for the policy must be unique within the pack.
        name: "s3-bucket-prefix",

        // The description should document what the policy does and why it exists.
        description: "Ensures S3 buckets use the required naming prefix.",

        // The enforcement level can be "advisory", "mandatory", or "disabled". An "advisory" enforcement level
        // simply prints a warning for users, while a "mandatory" policy will block an update from proceeding, and
        // "disabled" disables the policy from running.
        enforcementLevel: "mandatory",

        // The validateResourceOfType function allows you to filter resources. In this case, the rule only
        // applies to S3 buckets and reports a violation if the bucket prefix doesn't match the required prefix.
        validateResource: validateResourceOfType(aws.s3.Bucket, (bucket, args, reportViolation) => {
            const requiredPrefix = "logsbucket";
            const bucketPrefix = bucket.bucket || "";
            if (!bucketPrefix.startsWith(requiredPrefix)) {
                reportViolation(
                    `S3 bucket must use '${requiredPrefix}' prefix. Current prefix: '${bucketPrefix}'`);
            }
        }),

   };

   # Register policies -->

   new PolicyPack("aws-typescript", {
    policies: [
        s3BucketAclPolicy,
        s3BucketPrefixPolicy
    ],
  });
  ```

2. Developing unit tests for policies in test/ :
   ```                         
   # Developing Tests

   describe("s3-bucket-prefix-policy", () => {
    it("should pass when bucket has correct prefix", () => {
        const args = getEmptyArgs();
        args.type = "aws.s3.Bucket";
        args.props.bucket = "logsbucket";
        assert.doesNotThrow(() => {
            runResourcePolicy(s3BucketPrefixPolicy, args);
        });
    });

   ```

3. Run Unit Tests  
    ```    
   cd pulumi-policy-as-code/custom-policy-pack/                     
   npm test

   ```

# Results
