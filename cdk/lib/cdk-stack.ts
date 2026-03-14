import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import path from 'path';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // defining table schema with primary keys: (date, ticker)
    const stocksTable = new dynamodb.Table(this, 'StocksTable', {
        partitionKey: {
            name: 'date',
            type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
            name: 'ticker',
            type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, //charge per request
        removalPolicy: cdk.RemovalPolicy.DESTROY //deletes table upon "cdk destroy" --> prevents resources from running
    });

    // defining FetchHighestStockMover lambda Function
    const fetchHighestStockMover = new lambda.Function(this, 'FetchHighestStockMover', {
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/fetchHighestStockMover')), //where lambda code is located
        timeout: cdk.Duration.seconds(3) //to signal Cloudwatch alarm
    });

    // give fetchStockkMovers permission to write to stocksTable
    stocksTable.grantWriteData(fetchHighestStockMover);

    // defining FetchHighestStockMover EventBridge rule to trigger lambda
    const scheduleRule = new events.Rule(this, 'FetchHighestStockMoverSchedule', {
        schedule: events.Schedule.cron({ minute: '0', hour: '20' }) // trigger every 24 hours at 8pm UTC (when stock market closes)
    });

    // connecting EventBridge rule to FetchHighestStockMover lambda function
    scheduleRule.addTarget(new targets.LambdaFunction(fetchHighestStockMover));

    // setting up Cloudwatch alarm for FetchStockMovers lambda function
    if (fetchHighestStockMover.timeout) {
        new cloudwatch.Alarm(this, 'FetchStockMoverAlarm', {
            metric: fetchHighestStockMover.metricDuration().with({ //track the longest Lambda execution time
                statistic: 'Maximum',
            }),
            evaluationPeriods: 1, //trigger alarm upon 1 bad execution
            datapointsToAlarm: 1,
            threshold: fetchHighestStockMover.timeout.toMilliseconds(), //trigger alarm if execution exceeds 3000 ms
            treatMissingData: cloudwatch.TreatMissingData.IGNORE, //if lambda doesn't run, ignore missing data
            alarmName: 'Fetch Stock Mover Timeout'
        });
    }
  }
}
