const AWS = require("aws-sdk");

async function migrate() {
  let s3 = new AWS.S3({
    endpoint: "http://localhost:9000",
    apiVersion: "2006-03-01",
    s3ForcePathStyle: true,
    signatureVersion: "v4",
    region: "us-west-001",

    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  });

  await s3.createBucket({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Bucket: "pixelbin",
  }).promise();

  await s3.createBucket({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Bucket: "pixelbin-test",
  }).promise();

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { DatabaseConnection } = require("../dist/server/database");

  let connection = await DatabaseConnection.connect({
    username: "pixelbin",
    password: "pixelbin",
    host: "localhost",
    port: 5432,
    database: "pixelbin",
  });

  await connection.migrate();

  await connection.seed({
    users: [{
      email: "admin@pixelbin.org",
      fullname: "Pixelbin",
      password: "pixelbin",
      administrator: true,

      storage: [{
        name: "Minio",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        bucket: "pixelbin",
        region: "us-west-001",
        path: null,
        endpoint: "http://localhost:9000",
        publicUrl: null,
      }],
    }],
  });

  await connection.destroy();
}

migrate().catch(console.error);
