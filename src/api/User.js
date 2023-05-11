import {
  objectType,
  queryField,
  mutationField,
  idArg,
  list,
  inputObjectType,
  enumType,
  stringArg,
} from 'nexus';
import { User, UserPostVote, UserCommentVote } from 'nexus-prisma';
import { z } from 'zod';

const _User = objectType({
  name: User.$name,
  description: User.$description,
  definition(t) {
    t.field(User.id);
    t.field(User.createdAt);
    t.field(User.updatedAt);
    t.field(User.posts);
    t.field(User.comments);
    t.field(User.postVotes);
    t.field(User.commentVotes);
  },
});
export { _User as User };

const _UserPostVote = objectType({
  name: UserPostVote.$name,
  description: UserPostVote.$description,
  definition(t) {
    t.field(UserPostVote.userId);
    t.field(UserPostVote.user);
    t.field(UserPostVote.postId);
    t.field(UserPostVote.post);
    t.field(UserPostVote.direction);
    t.field(UserPostVote.createdAt);
    t.field(UserPostVote.updatedAt);
  },
});
export { _UserPostVote as UserPostVote };

const _UserCommentVote = objectType({
  name: UserCommentVote.$name,
  description: UserCommentVote.$description,
  definition(t) {
    t.field(UserCommentVote.userId);
    t.field(UserCommentVote.user);
    t.field(UserCommentVote.commentId);
    t.field(UserCommentVote.comment);
    t.field(UserCommentVote.direction);
    t.field(UserCommentVote.createdAt);
    t.field(UserCommentVote.updatedAt);
  },
});
export { _UserCommentVote as UserCommentVote };

const DIRECTIONS = ['UP', 'DOWN'];
const DIRECTION_TO_VALUE = { UP: 1, DOWN: -1 };

export const Direction = enumType({
  name: 'Direction',
  members: DIRECTIONS,
});

export const createUserPostVoteInput = inputObjectType({
  name: 'createUserPostVoteInput',
  definition(t) {
    t.string('postId');
    t.nonNull.field('direction', { type: 'Direction' });
  },
});

export const createUserPostVote = mutationField('createUserPostVote', {
  type: 'Post',
  args: { input: this.createUserPostVoteInput },
  async resolve(_, args, ctx) {
    const userId = ctx.user?.id;
    if (!userId) throw new Error('userId is required');

    const { postId, direction: directionArg } = args.input;
    const direction = DIRECTION_TO_VALUE[directionArg];

    await ctx.prisma.userPostVote.upsert({
      where: { userId_postId: { userId, postId } },
      update: { direction },
      create: {
        user: { connect: { id: userId } },
        post: { connect: { id: postId } },
        direction,
      },
    });

    return ctx.prisma.post.findUnique({ where: { id: postId } });
  },
});

export const deleteUserPostVote = mutationField('deleteUserPostVote', {
  type: 'Post',
  args: { postId: idArg() },
  async resolve(_, args, ctx) {
    const userId = ctx.user?.id;
    if (!userId) throw new Error('userId is required');

    const { postId } = args;

    const query = {
      where: { userId_postId: { userId, postId } },
    };

    const userPostVote = await ctx.prisma.userPostVote.findUnique(query);
    if (userPostVote) await ctx.prisma.userPostVote.delete(query);
    // error if no vote found?

    return ctx.prisma.post.findUnique({ where: { id: postId } });
  },
});

export const createUserCommentVoteInput = inputObjectType({
  name: 'createUserCommentVoteInput',
  definition(t) {
    t.string('commentId');
    t.nonNull.field('direction', { type: 'Direction' });
  },
});

export const createUserCommentVote = mutationField('createUserCommentVote', {
  type: 'Comment',
  args: { input: this.createUserCommentVoteInput },
  async resolve(_, args, ctx) {
    const userId = ctx.user?.id;
    if (!userId) throw new Error('userId is required');

    const { commentId, direction: directionArg } = args.input;
    const direction = DIRECTION_TO_VALUE[directionArg];

    await ctx.prisma.userCommentVote.upsert({
      where: { userId_commentId: { userId, commentId } },
      update: { direction },
      create: {
        user: { connect: { id: userId } },
        comment: { connect: { id: commentId } },
        direction,
      },
    });

    return ctx.prisma.comment.findUnique({ where: { id: commentId } });
  },
});

export const deleteUserCommentVote = mutationField('deleteUserCommentVote', {
  type: 'Comment',
  args: { commentId: idArg() },
  async resolve(_, args, ctx) {
    const userId = ctx.user?.id;
    if (!userId) throw new Error('userId is required');

    const { commentId } = args;
    const query = {
      where: { userId_commentId: { userId, commentId } },
    };

    const userCommentVote = await ctx.prisma.userCommentVote.findUnique(query);
    if (userCommentVote) await ctx.prisma.userCommentVote.delete(query);
    // else throw new Error("unable to find existing vote to delete");

    return ctx.prisma.comment.findUnique({ where: { id: commentId } });
  },
});

export const getUsers = queryField('getUsers', {
  type: list('User'),
  resolve(_root, _args, ctx) {
    return ctx.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },
});

export const getUser = queryField('getUser', {
  type: 'User',
  args: { id: idArg() },
  resolve(_, args, ctx) {
    return ctx.prisma.user.findUnique({
      where: { id: args.id },
    });
  },
});

export const getMe = queryField('getMe', {
  type: 'User',
  resolve(_, _args, ctx) {
    const { user } = ctx;
    return ctx.prisma.user.findUnique({
      where: { id: user?.id },
    });
  },
});

export const setUsername = mutationField('setUsername', {
  type: 'String',
  args: { username: stringArg() },
  async resolve(_, args, ctx) {
    const { username } = args;
    const { user } = ctx;

    if (!user) throw new Error('Not authenticated');

    // does user have a username?
    const currentUsername = await ctx.prisma.$queryRaw`
      select raw_app_meta_data ->> 'username' as username
        from auth.users where id = '${user.id}';
    `;
    if (currentUsername?.[0].username)
      throw new Error('user already has a username');

    // validate length and characters
    const usernameSchema = z
      .string()
      .regex(/^[a-zA-Z0-9-_]*$/)
      .min(3)
      .max(24);

    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success)
      throw new Error(JSON.parse(parsed.error.message)[0].message);

    // validate uniqueness
    const usernameExists = await ctx.prisma.$queryRaw`
      select raw_app_meta_data ->> 'username' 
        from auth.users where raw_app_meta_data->>'username' = '${username}';
    `;
    if (usernameExists.length !== 0) throw new Error('username already exists');

    await ctx.prisma.$queryRaw`
      update auth.users 
        set raw_app_meta_data = raw_app_meta_data || '{"username": "${username}"}'
        where id='${user.id}';
    `;

    await ctx.prisma.user.create({ data: { username } });

    return 'ok';
  },
});

export const deleteUser = mutationField('deleteUser', {
  type: 'User',
  args: { id: idArg() },
  resolve(_, args, ctx) {
    return ctx.prisma.user.update({
      where: { id: args.id },
      data: {
        deleted: true,
      },
    });
  },
});
