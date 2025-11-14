import * as aws from "@pulumi/aws";
import { PolicyPack, validateResourceOfType, ResourceValidationPolicy } from "@pulumi/policy";

export const s3BucketAclPolicy: ResourceValidationPolicy = {
      name: "s3-no-public-read",
        description: "Prohibits setting the publicRead or publicReadWrite permission on AWS S3 buckets.",
        enforcementLevel: "mandatory",
        validateResource: validateResourceOfType(aws.s3.Bucket, (bucket, args, reportViolation) => {
            if (bucket.acl === "public-read" || bucket.acl === "public-read-write") {
                reportViolation(
                    "You cannot set public-read or public-read-write on an S3 bucket. " +
                    "Read more about ACLs here: https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html");
            }
        }),
};

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


new PolicyPack("aws-typescript", {
    policies: [
        s3BucketAclPolicy,
        s3BucketPrefixPolicy
    ],
});
