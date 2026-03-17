import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamoDB = new DynamoDBClient(
    {
        region: process.env.AWS_REGION || 'us-west-2' //default region if AWS_REGION isn't set
    }
);

interface Mover {
    date: string;
    ticker: string;
    percentChange: number;
    closePrice: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const TABLENAME = process.env.STOCKS_TABLE_NAME!;

    try {
        // decode exclusiveStartKey from query parameters for pagination, if it exists
        let exclusiveStartKey = undefined;
        const nextPageToken = event.queryStringParameters?.nextPageToken;

        if (nextPageToken) {
            try {
                exclusiveStartKey = JSON.parse(Buffer.from(nextPageToken, 'base64').toString());
                console.log("Next page token received:", nextPageToken);
            } catch {
                return {
                    statusCode: 400,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ message: 'Invalid nextPageToken' })
                };
            }
        }

        // define query command to retrieve recent 7 highest movers from DynamoDB, sorted by date in descending order
        const queryCommand = new QueryCommand({
            TableName: TABLENAME,
            KeyConditionExpression: "leaderboard = :pk",
            ExpressionAttributeValues: {
                ":pk": { S: "TOP_MOVERS" },
            },
            ScanIndexForward: false, //sort by date in descending order to get most recent movers first
            Limit: 7, //limit results to 7 items
            ExclusiveStartKey: exclusiveStartKey //for pagination, start query from last evaluated key if it exists
        });

        // send command
        const response = await dynamoDB.send(queryCommand);

        if (!response.Items || response.Items.length === 0) {
            return {
                statusCode: 404,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ message: 'No movers found' })
            };
        }
        
        console.log("Retrieved 7 most recent highest movers from DynamoDB");

        // map DynamoDB items to movers array
        const movers: Mover[] = response.Items.map((item) => ({
            date: item.date.S!,
            ticker: item.ticker.S!,
            percentChange: parseFloat(item.percentChange.N!),
            closePrice: parseFloat(item.closePrice.N!)
        }));

        // encode last evaluated key for pagination in query parameters of next API request, if there are more items to retrieve
        const responseBody: { movers: Mover[], nextPageToken?: string } = { movers };
        if (response.LastEvaluatedKey) {
            responseBody.nextPageToken = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
        }

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(responseBody)
        };

    } catch (error) {
        console.error("Error reading from DynamoDB:", error);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }
};