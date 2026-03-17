import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import path from 'path';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // +++++++++ defining table schema with primary keys: (date, ticker) +++++++++
    const stocksTable = new dynamodb.Table(this, 'StocksTable', {
        partitionKey: {
            name: 'leaderboard',
            type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
            name: 'date',
            type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, //charge per request
        removalPolicy: cdk.RemovalPolicy.DESTROY //deletes table upon "cdk destroy" --> prevents resources from running
    });

    // +++++++++ fetching API key for Massive API from GitHub Secrets and storing in Secrets Manager +++++++++
    // if API key doesn't exist, throw error to prevent stack from deploying without API key secret
    const massiveApiKeySecretValue = process.env.MASSIVE_API_KEY;
    if (!massiveApiKeySecretValue) {
        throw new Error("Failed to create API key secret");
    }

    const massiveApiKeySecret = new secretsmanager.Secret(this, 'MassiveApiKeySecret', {
        secretName: 'massive-api-key',
        secretStringValue: cdk.SecretValue.unsafePlainText(massiveApiKeySecretValue)
    });

    // FETCH HIGHEST STOCK MOVER LAMBDA
    // +++++++++ defining FetchHighestStockMover lambda Function +++++++++
    const fetchHighestStockMover = new lambdaNode.NodejsFunction(this, 'FetchHighestStockMover', {
        entry: path.join(__dirname, '../lambda/fetchHighestStockMover/index.ts'), //where lambda handler lives
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: 'handler', //name of handler in index.ts file
        timeout: cdk.Duration.seconds(7), //to signal Cloudwatch alarm
        environment: {
            STOCKS_TABLE_NAME: stocksTable.tableName, //pass stocks table name to lambda environment variables
            MASSIVE_API_KEY_SECRET_NAME: massiveApiKeySecret.secretName //pass secret name to lambda environment variables
        },
        bundling: {
            externalModules: ['aws-sdk'], // keep aws-sdk external for Lambda
        },
    });

    // ++++++++ granting permissions to FetchHighestStockMover lambda function +++++++++
    // give fetchStockMovers permission to write to stocksTable
    stocksTable.grantWriteData(fetchHighestStockMover);

    // give fetchStockMovers permission to read API key from Secrets Manager
    massiveApiKeySecret.grantRead(fetchHighestStockMover);
    
    // ++++++++ setting up EventBridge to trigger FetchHighestStockMover lambda every 24 hours +++++++++
    // defining FetchHighestStockMover EventBridge rule
    const scheduleRule = new events.Rule(this, 'FetchHighestStockMoverSchedule', {
        schedule: events.Schedule.cron({ minute: '0', hour: '20' }) // trigger every 24 hours at 8pm UTC (when stock market closes)
    });

    // connecting EventBridge rule to FetchHighestStockMover lambda function
    scheduleRule.addTarget(new targets.LambdaFunction(fetchHighestStockMover));

    // ++++++++ setting up Cloudwatch alarm for FetchStockMovers lambda function +++++++++
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

    // GET MOVERS LAMBDA
    // +++++++++ defining GetMovers lambda Function +++++++++
    const getMovers = new lambdaNode.NodejsFunction(this, 'GetMovers', {
        entry: path.join(__dirname, '../lambda/getMovers/index.ts'), //where lambda handler lives
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: 'handler', //name of handler in index.ts file
        timeout: cdk.Duration.seconds(7), //to signal Cloudwatch alarm
        environment: {
            STOCKS_TABLE_NAME: stocksTable.tableName, //pass stocks table name to lambda environment variables
        },
        bundling: {
            externalModules: ['aws-sdk'], // keep aws-sdk external for Lambda
        },
    });

    // ++++++++ granting permissions to GetMovers lambda function +++++++++
    // give getMovers permission to read from stocksTable
    stocksTable.grantReadData(getMovers);

    // ++++++++ creating API Gateway REST API to trigger GetMovers lambda function +++++++++
    const stockMoversApi = new apigateway.RestApi(this, 'StockMoversApi', {
        restApiName: 'Stock Movers Service',
        description: 'This service returns the last 7 days of "winning stocks" from DynamoDB.',
        defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS, //allow CORS for all origins (for browser-based clients)
            allowMethods: ['GET']
        }
    });

    // ++++++++ define API Gateway resource and method to trigger GetMovers lambda function ++++++++
    const moversResource = stockMoversApi.root.addResource('movers'); //endpoint: /movers
    moversResource.addMethod('GET', new apigateway.LambdaIntegration(getMovers)); //GET /movers triggers getMovers lambda function

    // SEED STOCKS LAMBDA
    // +++++++++ defining SeedStocks lambda Function +++++++++
    const seedStocks = new lambdaNode.NodejsFunction(this, 'SeedStocks', {
        entry: path.join(__dirname, '../lambda/seedStocks/index.ts'), //where lambda handler lives
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: 'handler', //name of handler in index.ts file
        timeout: cdk.Duration.seconds(30), //to signal Cloudwatch alarm
        environment: {
            STOCKS_TABLE_NAME: stocksTable.tableName, //pass stocks table name to lambda environment variables
            MASSIVE_API_KEY_SECRET_NAME: massiveApiKeySecret.secretName //pass secret name to lambda environment variables
        },
        bundling: {
            externalModules: ['aws-sdk'], // keep aws-sdk external for Lambda
        },
    });

    // ++++++++ granting permissions to SeedStocks lambda function +++++++++
    // give seedStocks permission to write to stocksTable
    stocksTable.grantWriteData(seedStocks);

    // give seedStocks permission to read API key from Secrets Manager
    massiveApiKeySecret.grantRead(seedStocks);
  }
}
