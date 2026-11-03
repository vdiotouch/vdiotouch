import { registerDecorator, ValidationOptions } from 'class-validator';

/** Fails when the UTF-8 encoded string is longer than `maxBytes` (one character can be up to 4 bytes). */
export function MaxBytes(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxBytes',
      target: object.constructor,
      propertyName,
      constraints: [maxBytes],
      options: {
        message: `${propertyName} must be at most ${maxBytes} bytes`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maxBytes,
      },
    });
  };
}
