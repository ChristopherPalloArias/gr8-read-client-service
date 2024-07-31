import express from 'express';
import AWS from 'aws-sdk';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';

// AWS region and Lambda function configuration
const region = "us-east-2";
const lambdaFunctionName = "fetchSecretsFunction_gr8";

// Function to invoke Lambda and fetch secrets
async function getSecretFromLambda() {
  const lambda = new AWS.Lambda({ region: region });
  const params = {
    FunctionName: lambdaFunctionName,
  };

  try {
    const response = await lambda.invoke(params).promise();
    const payload = JSON.parse(response.Payload);
    if (payload.errorMessage) {
      throw new Error(payload.errorMessage);
    }
    const body = JSON.parse(payload.body);
    return JSON.parse(body.secret);
  } catch (error) {
    console.error('Error invoking Lambda function:', error);
    throw error;
  }
}

// Function to start the service
async function startService() {
  let secrets;
  try {
    secrets = await getSecretFromLambda();
  } catch (error) {
    console.error(`Error starting service: ${error}`);
    return;
  }

  const app = express();
  const port = 8095;

  app.use(cors());
  app.use(express.json());

  // Configure AWS DynamoDB
  AWS.config.update({
    region: region,
    accessKeyId: secrets.AWS_ACCESS_KEY_ID,
    secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY,
  });

  const dynamoDB = new AWS.DynamoDB.DocumentClient();

  // Swagger setup
  const swaggerOptions = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'List Client Service API',
        version: '1.0.0',
        description: 'API for listing clients',
      },
    },
    apis: ['./src/index.js'],
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  /**
   * @swagger
   * /clients:
   *   get:
   *     description: Get the list of clients
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   ci:
   *                     type: string
   *                   firstName:
   *                     type: string
   *                   lastName:
   *                     type: string
   *                   phone:
   *                     type: string
   *                   address:
   *                     type: string
   */
  app.get('/clients', async (req, res) => {
    const params = {
      TableName: 'ClientsList_gr8',
    };

    try {
      const data = await dynamoDB.scan(params).promise();
      res.send(data.Items);
    } catch (err) {
      console.error('Error fetching clients:', err);
      res.status(500).send({ message: 'Error fetching clients', error: err });
    }
  });

  // Root route to check if the server is running
  app.get('/', (req, res) => {
    res.send('List Client Service Running');
  });

  app.listen(port, () => {
    console.log(`List Client service listening at http://localhost:${port}`);
  });
}

startService();
