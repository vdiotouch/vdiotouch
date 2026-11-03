import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@/src/common/database/schemas/abstract.schema';

export const USER_COLLECTION_NAME = 'users';

@Schema({
  timestamps: true,
  collection: USER_COLLECTION_NAME,
})
export class UserDocument extends AbstractDocument {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  /** Tokens issued before this moment are refused, so changing the password logs out every device. */
  @Prop({ required: false })
  password_changed_at?: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserDocument);
