import * as assert from "assert";
import * as policy from "@pulumi/policy";
import { s3BucketAclPolicy } from "../index";
import { runResourcePolicy, getEmptyArgs } from "./test-helpers";

describe("s3-acl-must-be-private", () => {

    it("should pass when ACL is private", () => {
        const args = getEmptyArgs();
        args.type = "aws.s3.Bucket";
        args.props.acl = "private";

        assert.doesNotThrow(() => {
            runResourcePolicy(s3BucketAclPolicy, args);
        });
    });

    it("should fail when ACL is public-read", () => {
        const args = getEmptyArgs();
        args.type = "aws.s3.Bucket";
        args.props.acl = "public-read";

        assert.throws(() => {
            runResourcePolicy(s3BucketAclPolicy, args);
        });
    });

    it("should fail when ACL is public-read-write", () => {
        const args = getEmptyArgs();
        args.type = "aws.s3.Bucket";
        args.props.acl = "public-read-write";

        assert.throws(() => {
            runResourcePolicy(s3BucketAclPolicy, args);
        });
    });

    it("should pass if resource is not an S3 bucket (policy ignores it)", () => {
        const args = getEmptyArgs();
        args.type = "aws.s3.OtherThing";

        assert.doesNotThrow(() => {
            runResourcePolicy(s3BucketAclPolicy, args);
        });
    });
});
