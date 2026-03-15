import {Context} from 'aws-lambda'
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsManager = new SecretsManagerClient({});

export const handler = async (event: any, context: Context) => {
    console.log("Fetching highest stock mover...")

    // fetch Massive API key from Secrets Manager
    try {
        const command = new GetSecretValueCommand({
            SecretId: process.env.MASSIVE_API_KEY_SECRET_NAME!
        });

        const response = await secretsManager.send(command);
        if (!response.SecretString) {
            throw new Error("Massive API key value missing")
        }
        const massiveApiKey = response.SecretString;

        console.log("API Key retrieved");

    } catch (error) {
        console.error("Error retrieving API key:", error);
        throw new Error("Failed to retrieve API key");
    }

    return {
        statusCode: 200,
        body: "Highest Mover Lambda successfully executed"
    };
};