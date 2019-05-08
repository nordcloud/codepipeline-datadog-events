//import { ScheduledEvent } from 'aws-lambda';
import "source-map-support/register";
import { SQSEvent, Context, SNSMessage } from "aws-lambda";

import fetch from "node-fetch";

const DATADOG_API = "https://api.datadoghq.com/api/v1";
const DD_API_KEY = process.env.DD_API_KEY;

interface CloudwatchPipelineEventDetailType {
  owner: string;
  category: string;
  provider: string;
}

interface CloudwatchPipelineEventDetail {
  pipeline: string;
  "execution-id": string;
  state: string;
  stage?: string;
  action?: string;
  type?: CloudwatchPipelineEventDetailType;
}

interface CloudwatchPipelineEvent {
  "detail-type": string;
  time: string;
  region: string;
  resources: string[];
  detail: CloudwatchPipelineEventDetail;
}

interface DatadogEventCreateInput {
  title: string;
  text: string;
  date_happened?: number;
  priority?: "normal" | "low";
  host?: string;
  tags?: string[];
  alert_type?: "info" | "warning" | "error" | "success";
  aggregation_key?: string;
  source_type_name?: string;
}

const datadogCreateEvent = async (input: DatadogEventCreateInput) =>
  fetch(`${DATADOG_API}/events?api_key=${DD_API_KEY}`, {
    method: "post",
    body: JSON.stringify(input),
    headers: {
      "Content-type": "application/json"
    }
  });

const getEventMessage = (
  event: CloudwatchPipelineEvent
): { text: string; priority?: "low" | "normal" } => {
  switch (event["detail-type"]) {
    case "CodePipeline Pipeline Execution State Change":
      return {
        text: `Pipeline ${event.detail.pipeline} in ${
          event.region
        } changed state to ${event.detail.state}`
      };

    case "CodePipeline Stage Execution State Change":
      return {
        text: `Pipeline ${event.detail.pipeline} in ${
          event.region
        } changed stage ${event.detail.stage} state to ${event.detail.state}`,
        priority: "low"
      };
      break;

    case "CodePipeline Action Execution State Change":
      return {
        text: `Pipeline ${event.detail.pipeline} in ${
          event.region
        } changed state of action ${event.detail.action} in stage ${
          event.detail.stage
        } to ${event.detail.state}`,
        priority: "low"
      };
      break;

    default:
      console.log(
        JSON.stringify({
          level: "error",
          message: "Wrong event detail type: " + event["detail-type"]
        })
      );
      throw new Error("invalid event");
  }
};

const getEventSeverity = (event: CloudwatchPipelineEvent) => {
  switch (event.detail.state) {
    case "FAILED":
      return "error";
    case "SUCCEEDED":
      return "success";
    default:
      return "info";
  }
};

const makeDatadogEvent = (
  event: CloudwatchPipelineEvent
): DatadogEventCreateInput => ({
  title: `${event.detail.pipeline} ${event["detail-type"]}`,
  ...getEventMessage(event),
  alert_type: getEventSeverity(event),
  aggregation_key: event.detail["execution-id"],
  tags: [`pipeline:${event.detail.pipeline}`, `region:${event.region}`]
});

export const main = async (event: SQSEvent, _context: Context) =>
  await Promise.all(
    event.Records.map(v => JSON.parse(v.body) as SNSMessage)
      .map(v => JSON.parse(v.Message) as CloudwatchPipelineEvent)
      .filter(v => v["detail-type"] != "AWS API Call via CloudTrail")
      .map(async v => {
        console.log(
          JSON.stringify({ message: v, alert_type: getEventSeverity(v) })
        );
        try {
          return datadogCreateEvent(makeDatadogEvent(v));
        } catch (err) {
          console.log(err);
        }
      })
  );
