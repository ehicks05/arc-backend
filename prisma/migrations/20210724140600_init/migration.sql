-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "authorId" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "postId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorId" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPostVote" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "direction" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "UserCommentVote" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "direction" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    PRIMARY KEY ("userId","commentId")
);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD FOREIGN KEY ("parentCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPostVote" ADD CONSTRAINT "UserPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPostVote" ADD CONSTRAINT "UserPostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommentVote" ADD CONSTRAINT "UserCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommentVote" ADD CONSTRAINT "UserCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateFunction
CREATE OR REPLACE FUNCTION getAgeInHours(dt timestamptz) RETURNS integer AS $$
	BEGIN
		RETURN (EXTRACT(EPOCH FROM (now() - dt)) / 60 / 60);
	END;
$$ LANGUAGE plpgsql;

-- CreateFunction
CREATE OR REPLACE FUNCTION getNetVotes(id text, createdAt timestamptz) RETURNS integer AS $$
	DECLARE
		netVotes integer = 0;
	BEGIN
		netVotes = (select sum(direction) from "UserPostVote" where "postId" = id);
		RETURN coalesce(netVotes, 0);
	END;
$$ LANGUAGE plpgsql;

-- CreateFunction
CREATE OR REPLACE FUNCTION getCommentNetVotes(id text, createdAt timestamptz) RETURNS integer AS $$
	DECLARE
		netVotes integer = 0;
	BEGIN
		netVotes = (select sum(direction) from "UserCommentVote" where "commentId" = id);
		RETURN coalesce(netVotes, 0);
	END;
$$ LANGUAGE plpgsql;

-- CreateFunction
CREATE OR REPLACE FUNCTION getScore(id text, createdAt timestamptz) RETURNS real AS $$
	BEGIN
		RETURN getNetVotes(id, createdAt) / ((getAgeInHours(createdAt) + 2) ^ 1.5);
	END;
$$ LANGUAGE plpgsql;

-- CreateFunction
CREATE OR REPLACE FUNCTION getCommentScore(id text, createdAt timestamptz) RETURNS real AS $$
	BEGIN
		RETURN getCommentNetVotes(id, createdAt) / ((getAgeInHours(createdAt) + 2) ^ 1.5);
	END;
$$ LANGUAGE plpgsql;

-- CreateProcedure
CREATE OR REPLACE PROCEDURE updateScore() AS $$
	BEGIN
		update "Post" set score=coalesce(getScore("id", "createdAt"), 0);
		update "Comment" set score=coalesce(getCommentScore("id", "createdAt"), 0);
	END;
$$ LANGUAGE plpgsql;

-- inserts a row into arc.users
create function arc.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = arc
as $$
begin
  insert into arc.users (id)
  values (new.id);
  return new;
end;
$$;

-- trigger the function every time a user is created
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure arc.handle_new_user();
