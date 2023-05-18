import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginInlineTrace } from 'apollo-server-core';
import { createClient } from '@supabase/supabase-js';
import { schema } from './schema';
import prisma from './prisma';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || '',
);

const createApolloServer = () => {
  const server = new ApolloServer({
    schema,
    context: ({ req }: any) => {
      const user = req.user
        ? {
            ...req.user,
            id: req.user.app_metadata.username,
            authId: req.user.sub,
          }
        : undefined;

      return {
        prisma,
        supabase,
        req,
        user,
      };
    },
    plugins: [ApolloServerPluginInlineTrace()],
  });

  return server;
};

const _createApolloServer = createApolloServer;
export { _createApolloServer as createApolloServer };