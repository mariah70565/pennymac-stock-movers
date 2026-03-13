import {Context} from 'aws-lambda'

export const handler = async (event: any, context: Context) => {
    console.log("Fetching highest stock mover...")

    return {
        statusCode: 200,
        body: "Highest Mover Lambda successfully executed"
    };
};