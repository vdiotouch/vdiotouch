import { Field, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';
import { PageInfo } from '@/src/api/assets/models/asset.model';

@ObjectType()
export class Webhook {
  @Field()
  @Expose()
  _id: string;

  @Field()
  @Expose()
  url: string;

  /** The secret itself is never sent back; it's only used to sign webhook calls. */
  @Field()
  @Expose()
  has_secret: boolean;

  @Field()
  @Expose()
  created_at: Date;

  @Field()
  @Expose()
  updated_at: Date;
}

@ObjectType()
export class PaginatedWebhookResponse {
  @Field((type) => [Webhook])
  @Expose()
  webhooks: Webhook[];

  @Field((type) => PageInfo)
  @Expose()
  page_info: PageInfo;
}
