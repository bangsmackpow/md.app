import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { SyncProvider, SyncConfig } from './types';

export class S3SyncProvider implements SyncProvider {
  private getClient(config: SyncConfig): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async upload(name: string, content: string, config: SyncConfig): Promise<void> {
    const client = this.getClient(config);
    const key = name.endsWith('.md') ? name : `${name}.md`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: content,
        ContentType: "text/markdown",
      }));
    } catch (err: any) {
      console.error(`S3 Upload Error [${key}]:`, err.message, err.$metadata);
      throw err;
    }
  }

  async download(name: string, config: SyncConfig): Promise<string> {
    const client = this.getClient(config);
    const key = name.endsWith('.md') ? name : `${name}.md`;
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }));
      return await response.Body?.transformToString() || '';
    } catch (err: any) {
      console.error(`S3 Download Error [${key}]:`, err.message);
      throw err;
    }
  }
}
