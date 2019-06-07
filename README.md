# aws-codepipeline-events
Monitor your AWS CodePipelines with CloudWatch, Datadog and Slack.

This project was created as an internal tool to get information about succeeded and failed steps in CodePipelines deployed in almost all regions available in Amazon Web Services. As CloudWatch does not provide any metrics for this service, we had to create something on our own. Initial idea was to subscribe to Cloudwatch Events and push everything to Datadog Events, but then we have added integration for Slack and a scheduled lambda which pushes custom metric to CloudWatch.

## Architecture

![Alt text](img/aws-codepipeline-events.png?raw=true "Title")

## Features
- Datadog Events with information about changed pipeline, step and action statuses
- Slack notification about changed pipeline status
- Cloudwatch custom metric with pipeline status (0 - succeeded, 1 - in progress, 2 - failed)
- Receives events from all regions.

*Note*: this solution is not easily customizable and probably you will need to modify serverless.yml or handler.ts to remove features you do not need.

## Requirements
- Serverless Framework
- Datadog API key stored as `/datadog/DD_API_KEY` in AWS SSM Paramter Store
- Slack Webhook URL stored as `/slack/SLACK_WEBHOOK_URL` in AWS SSM Parameter Store

## Deployment
```console
sls deploy --region eu-west-1 --stage prod
```

This will create Lambda functions and SQS queue which is needed for next step.

```console
for i in $(aws ec2 describe-regions --query "Regions[].{Name:RegionName}" --output text); do aws cloudformation deploy --stack-name codepipeline-events --template-file cfn/subscriber.yml --region $i --parameter-overrides "PUT SQS ARN HERE" --capabilities CAPABILITY_IAM; done
```
Or you can use StackSets 😉

## Authors
- Jakub Wozniak, Nordcloud 🇵🇱

