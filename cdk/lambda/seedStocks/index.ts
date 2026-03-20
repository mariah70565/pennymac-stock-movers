import { Context, ScheduledEvent } from 'aws-lambda'
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { restClient } from '@massive.com/client-js';
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const secretsManager = new SecretsManagerClient(
    {
        region: process.env.AWS_REGION || 'us-west-2' //default region if AWS_REGION isn't set
    }
);
const dynamoDB = new DynamoDBClient(
    {
        region: process.env.AWS_REGION || 'us-west-2' //default region if AWS_REGION isn't set
    }
);

interface StockAggregate {
    T: string //The exchange symbol that this item is traded under.
    c: number //The close price for the symbol in the given time period.
    h: number //The highest price for the symbol in the given time period.
    l: number //The lowest price for the symbol in the given time period.
    n?: number //optional The number of transactions in the aggregate window.
    o: number //The open price for the symbol in the given time period.
    otc?: boolean //optional Whether or not this aggregate is for an OTC ticker. This field will be left off if false.
    t: number //The Unix millisecond timestamp for the end of the aggregate window.
    v: number //The trading volume of the symbol in the given time period.
    vw?: number //optional The volume weighted average price.
}

export const handler = async (event: ScheduledEvent, context: Context) => {
    const TABLENAME = process.env.STOCKS_TABLE_NAME!;
    const APIKEYSECRETNAME = process.env.MASSIVE_API_KEY_SECRET_NAME!;

    const watchList = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']; //list of tickers to compare

    console.log("Fetching highest stock mover...")

    let massiveApiKey: string;
    // 1. fetch Massive API key from Secrets Manager
    try {
        const command = new GetSecretValueCommand({
            SecretId: APIKEYSECRETNAME
        });

        const response = await secretsManager.send(command);
        if (!response.SecretString) {
            throw new Error("Massive API key value missing")
        }
        
        massiveApiKey = response.SecretString;

        console.log("API Key retrieved");
    
    // if error occurs during API key retrieval, log error and throw new error to signal failure
    } catch (error) {
        console.error("Error retrieving API key:", error);
        throw new Error("Failed to retrieve API key");
    }

    // 2. call Massive API to fetch highest stock mover
    const fetchStockData = async (rest: any, date: string, retries = 3): Promise<StockAggregate[]> => {
        // implementing retry logic up to 3 attempts with delays for rate limit errors and other API errors
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                //fetch aggregate stock data for all stocks
                const response = await rest.getGroupedStocksAggregates( 
                {
                    date: date,
                    adjusted: true,
                });

                // if no stock data is found for today, return empty array to signal no data found
                if (!response.results || response.results.length === 0) {
                    console.log("No stock data found for today");
                    return [];
                }

                return response.results; //return stock data if successful
            
            } catch (error: any) {
                // handle rate limit error (status code 429) by retrying after a delay
                if (error.statusCode === 429) {
                    console.warn(`Reached Massive API rate limit on attempt ${attempt}`)
                
                } else {
                    console.warn(`API fetch failed on attempt ${attempt}:`, error);
                }

                // keep retrying API call if max retries aren't reached, with a delay between attempts
                if (attempt < retries) {
                    const delay = Math.pow(2, attempt) * 1000; //exponential backoff delay
                    console.log(`Retrying in ${delay / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay)); //wait before retrying
                
                } else {
                    console.error("Stock API failed after maximum retries:", error);
                    throw new Error("Failed to fetch stock data from Massive API after multiple attempts");
                }
            }
        }
        return []; //return empty array if all retries fail
    }

    // 3. fetch percent change for each stock and find highest mover
    try {
        const rest = restClient(massiveApiKey, 'https://api.massive.com'); //initialize Massive API client
        const seedDates = ["2026-03-18"]
        for (const date of seedDates) {
            const results = await fetchStockData(rest, date); //fetch stock data
            
            // filter results by watchlist and sort by absolute percent change
            const movers = results
                .filter((stock: StockAggregate) => watchList.includes(stock.T)) //filter for stocks in watchlist
                .map((stock: StockAggregate) => ({
                    ticker: stock.T,
                    percentChange: stock.o !== 0 ? ((stock.c - stock.o) / stock.o) * 100 : 0, //calculate percent change from open to close. 0 if open price is 0 to avoid division by 0 error
                    closePrice: stock.c //close price to store in DynamoDB
                }))
                .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)); //sort in descending orderby absolute percent change
            
            // 4. store highest mover data in DynamoDB
            const highestMover = movers[0]; //grab highest mover in movers list
        
            // return if no highest mover is found today
            if (!highestMover) {
                console.log(`No highest mover found for ${date}`);
                continue; //skip to next date in seedDates
            }

            console.log(`Highest Mover for ${date}:`, highestMover);
            
            // define put command to store highest mover data in DynamoDB
            const putCommand = new PutItemCommand({
                TableName: TABLENAME,
                Item: {
                    leaderboard: { S: "TOP_MOVERS"}, //partition key
                    date: { S: date }, //current date as sort key
                    ticker: { S: highestMover.ticker },
                    percentChange: { N: highestMover.percentChange.toString() }, //percent change as attribute
                    closePrice: { N: highestMover.closePrice.toString()} //close price as attribute
                }
            });

            // send command
            await dynamoDB.send(putCommand);
            console.log(`Highest mover data stored in DynamoDB for ${date}`);
        }
            
    } catch (error) {
        console.error("Error fetching data from Massive API:", error);

        return {
            statusCode: 503, //service unavailable status code to signal API fetch failure
            body: JSON.stringify({ message: 'Stock API unavailable, skipping today\'s fetch and store. Will try again tomorrow.' })
        };
    }

    

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Highest Stock mover successfully fetched and stored' })
    };
};