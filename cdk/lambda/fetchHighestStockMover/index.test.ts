import { handler } from "./index";
import { ScheduledEvent } from 'aws-lambda';
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// ++++++++ mocking Massive API +++++++++
// replaces actual Massive API client with mock implementation that returns empty results to avoid making real API calls during testing
jest.mock('@massive.com/client-js', () => ({
    restClient: jest.fn(() => ({
        getGroupedStocksAggregates: jest.fn(async () => ({
            results: [] //return no stock data
        }))
    }))
}), { virtual: true }); //tells Jest this is a virtual module that doesn't exist in node_modules, so it won't throw an error when we import it in our lambda code


// ++++++++ mocking AWS SDK Secrets Manager +++++++++
// replaces actual Secrets Manager client with mock implementation that returns a fake API key to avoid making real calls to AWS Secrets Manager during testing
jest.mock('@aws-sdk/client-secrets-manager', () => {
    return {
        SecretsManagerClient: jest.fn().mockImplementation(() => ({
            send: jest.fn(async (command: any) => {
                // if command is to get a secret, return a fake secret
                if (command instanceof GetSecretValueCommand) {
                    return { SecretString: 'fake-api-key' };
                }
            })
        })),
        // export GetSecretValueCommand so it can be used in our lambda code without throwing an error, but we don't need to mock its implementation since we're only checking the type of command in our mock send function
        GetSecretValueCommand: jest.requireActual('@aws-sdk/client-secrets-manager').GetSecretValueCommand
    };
});

// +++++++ mocking DynamoDB DocumentClient +++++++++
jest.mock('@aws-sdk/client-dynamodb', () => {
    return {
        DynamoDBClient: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockResolvedValue({}) //pretend the put command worked
        })),
        PutItemCommand: jest.requireActual('@aws-sdk/client-dynamodb').PutItemCommand
    };
});

// ++++++++ setting fake environment variables for testing +++++++++
process.env.STOCKS_TABLE_NAME = "test-table";
process.env.MASSIVE_API_KEY = "test-api-key";
process.env.MASSIVE_API_KEY_SECRET_NAME = "test-secret";

// +++++++ unit test for FetchHighestStockMover lambda function +++++++++
describe('Unit Test for FetchHighestStockMover Lambda Function', function() {
    // in index.test.ts, inside describe() or a beforeEach
    const fakeRestClient = {
        getGroupedStocksAggregates: jest.fn(async () => ({ results: [] }))
    };

    const mockRestClient = jest.mocked(require('@massive.com/client-js').restClient);
    mockRestClient.mockReturnValue(fakeRestClient);

    // API Failure case: when the function fails to retrieve the API key from Secrets Manager, it should return a 503 status code
    it('should return status code 503 when API fails', async () => {
        const spy = jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1); //set to monday

        fakeRestClient.getGroupedStocksAggregates.mockRejectedValueOnce(new Error("API error")); //mock API call to throw an error

        const event = {} as ScheduledEvent; //fake empty event data
        const context = {} as any; //fake empty context data

        const result = await handler(event, context); //run handler with fake data

        // check results
        expect(result.statusCode).toBe(503);

        spy.mockRestore(); //clean up stock
    });

    // No Stock Data case: when the function executes successfully but no stock data is found, it should return a 404 status code
    it('should return status code 404 when no stock data is found', async () => {
        // Mock getDay to return 1 (Monday) to avoid weekend check
        const spy = jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1); //set to monday

        const event = {} as ScheduledEvent; //fake empty event data
        const context = {} as any; //fake empty context data

        const result = await handler(event, context); //run handler with fake data

        // check results
        expect(result.statusCode).toBe(404);

        spy.mockRestore(); //clean up mock
    });

    // Weekend case: when the function executes on a weekend so no stock data is found, it should return a 200 status code with a message indicated the market is closed
    it('should return status code 200 when the market is closed', async () => {
        // Mock getDay to return 1 (Monday) to avoid weekend check
        const spy = jest.spyOn(Date.prototype, 'getDay').mockReturnValue(6); //set to saturday

        const event = {} as ScheduledEvent; //fake empty event data
        const context = {} as any; //fake empty context data

        const result = await handler(event, context); //run handler with fake data

        // check results
        expect(result.statusCode).toBe(200);
        expect(result.body).toContain("Market is closed today");

        spy.mockRestore(); //clean up mock
    });

    // Data processing case: when the function executes successfully and processes stock data, it should return a 200 status code with a success message
    it('should process stock data and return status code 200', async () => {
        const spy = jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1); //set to monday

        fakeRestClient.getGroupedStocksAggregates.mockResolvedValueOnce({
            results: [
                { T: 'AAPL', o: 100, c: 110, h: 110, l: 100, t: 0, v: 0 }, //10% increase
                { T: 'MSFT', o: 200, c: 180, h: 200, l: 180, t: 0, v: 0 }, //10% decrease
                { T: 'GOOGL', o: 150, c: 165, h: 165, l: 150, t: 0, v: 0 }, //15% increase
                { T: 'AMZN', o: 300, c: 270, h: 300, l: 270, t: 0, v: 0 }, //15% decrease
            ]
        });

        const event = {} as ScheduledEvent; //fake empty event data
        const context = {} as any; //fake empty context data

        const result = await handler(event, context); //run handler with fake data

        // check results
        expect(result.statusCode).toBe(200);
        expect(result.body).toContain("Highest Stock mover successfully fetched and stored");

        spy.mockRestore(); //clean up mock
    });
});