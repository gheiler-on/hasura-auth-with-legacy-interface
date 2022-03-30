import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { emailClient } from '@/email';
import { gqlSdk, getUserByEmail, generateTicketExpiresAt, ENV } from '@/utils';
import { sendError } from '@/errors';
import { Joi, email, redirectTo } from '@/validation';

export const userPasswordResetSchema = Joi.object({
  email: email.required(),
  options: Joi.object({
    redirectTo,
  }).default(),
}).meta({ className: 'UserPasswordResetSchema' });

export const userPasswordResetHandler: RequestHandler<
  {},
  {},
  {
    email: string;
    options: {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const {
    email,
    options: { redirectTo },
  } = req.body;
  const user = await getUserByEmail(email);

  if (!user || user.disabled) {
    return sendError(res, 'user-not-found');
  }

  const ticket = `passwordReset:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60); // 1 hour

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  const template = 'password-reset';
  await emailClient.send({
    template,
    locals: {
      link: `${ENV.AUTH_SERVER_URL}/verify?&ticket=${ticket}&type=passwordReset&redirectTo=${redirectTo}`,
      ticket,
      redirectTo,
      locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
      displayName: user.displayName,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
    message: {
      to: email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket as string,
        },
        'x-redirect-to': {
          prepared: true,
          value: redirectTo,
        },
        'x-email-template': {
          prepared: true,
          value: template,
        },
      },
    },
  });

  return res.send('ok');
};
