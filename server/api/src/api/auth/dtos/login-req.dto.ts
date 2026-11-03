import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '@/src/api/auth/lib/normalize-email';

export class LoginReqDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /** No length rule here, so users who signed up with the old 5-character minimum can still log in. */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
