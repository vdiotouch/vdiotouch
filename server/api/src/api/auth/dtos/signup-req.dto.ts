import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '@/src/api/auth/constants';
import { MaxBytes } from '@/src/api/auth/validators/max-bytes.validator';
import { normalizeEmail } from '@/src/api/auth/lib/normalize-email';

export class SignupReqDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, description: `At most ${PASSWORD_MAX_BYTES} bytes` })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxBytes(PASSWORD_MAX_BYTES)
  password: string;
}
