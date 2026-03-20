# Stock Movers Dashboard
A fully automated serverless pipeline that tracks daily stock market movers from a watchlist of stocks, computes and stores the one with the highest absolute percent change, and displays 7 of them at a time on a live dashboard.
- 🏆 Top Movers leaderboard showing the 3 most frequent daily winners
- 💵 A table of stocks with the highest absolute percent change (color coded by green and red to show positive and negative percent change)
- 📈 A line graph showing percent change of stocks

## Features
- Daily automated stock data triggered by EventBridge every 24 hours
- GET Movers API with pagination
- CloudWatch alarms and logs to monitor lambdas
- Light and dark mode toggling with default OS preferences

## Live Demo
[Stock Movers Dashboard](http://cdkstack-websitebucket75c24d94-usjaukpec8kh.s3-website-us-west-2.amazonaws.com)

## Tech Stack
- **IaC:** AWS CDK (TypeScript)
- **Backend:** AWS Lambda, AWS DynamoDB, AWS API Gateway, AWS EventBridge, AWS Secrets Manager, AWS CloudWatch, Massive API
- **Frontend:** React, TypeScript, Tailwind CSS, Chart.js
- **CI/CD:** GitHub Actions

## Architecture Overview
- **EventBridge** triggers FetchHighestStockMover lambda daily at 5am UTC
- **FetchHighestStockMover** fetches stock data from Massive API, calculates the highest percent change for each of the stocks in the watchlist, and store the result in DynamoDB
- **DynamoDB** stores the daily top mover with its corresponding date of movement, ticker, percent change, and close price
- **API Gateway** connects to a REST endpoint `GET /movers` with pagination support
- **GetMovers Lambda** queries DynamoDB and returns the last 7 days of top movers
- **S3** hosts the React frontend

## CI/CD
GitHub Actions automatically runs tests, builds the frontend, and deploys the  stack on every push to `main` branch

### Repository secrets:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- MASSIVE_API_KEY
- VITE_API_URL

## Watchlist
```
['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']
```

## Prerequisites
- Node.js
- AWS CLI
- AWS CDK CLI (`npm install -g aws-cdk`)
- [Massive API](https://massive.com) account and API key & secret

## Deployment

### 1. Clone the repository
```bash
git clone
cd pennymac-stock-movers
```

### 2. Install CDK dependencies
```bash
cd cdk
npm install
```

### 3. Boostrap CDK (only if first time using CDK in your region)
```bash
npx cdk bootstrap
```

### 4. Install Lambda dependencies
```bash
cd lambda
npm install
```

### 5. Set `MASSIVE_API_KEY`
```bash
export MASSIVE_API_KEY=<your_api_key>
```

### 6. 1st deploy to retrieve API Gateway URL for frontend
```bash
cd ../cdk
npx cdk deploy
```
> API Gateway URL can be found from the deploy output, labeled `StockMoversApiEndpoint`. Save this for Step 9.

### 7. Install frontend dependencies
```bash
cd ../frontend
npm install
```

### 8. Build frontend
```bash
npm run build
```

### 9. Set `VITE_API_URL`
Create a `.env` file in `frontend/` directory
```
VITE_API_URL=<your-api-gateway-url>/movers
```

### 10. Final Deploy
```bash
cd ../cdk
npx cdk deploy
```