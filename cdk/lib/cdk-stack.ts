import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Defining table schema with primary keys: (date, ticker)
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
  }
}
