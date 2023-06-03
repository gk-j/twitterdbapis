const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username; //sendingdata
        next();
      }
    });
  }
};

const follows = async (request, response, next) => {
  const { tweetId } = request.params;
  let isFollowing = await db.get(`
      select * from follower
      where
      follower_user_id =  (select user_id from user where username = "${request.username}")
      and 
      following_user_id = (select user.user_id from tweet natural join user where tweet_id = ${tweetId});
      `);
  if (isFollowing === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};

//API-1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}'`;

  const dbUser = await db.get(selectUserQuery);

  if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    if (dbUser === undefined) {
      const createUserQuery = `
            INSERT INTO
            user (username,password,name,gender)
            VALUES
                (
                    '${username}',
                    '${hashedPassword}',
                    '${name}',
                    '${gender}'
                )`;
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("User already exists");
    }
  }
});

//API-2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const username = request.username;
  const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
  const User = await db.get(getUserIdQuery);
  const userId = User.user_id;

  const getUserFollowerQuery = `SELECT * FROM user inner join follower on user.user_id = follower.follower_user_id where user_id ='${userId}'`;
  const follower = await db.all(getUserFollowerQuery);
  const getFollowerIdArray = follower.map(
    (user_follower) => user_follower.following_user_id
  );

  const getTweetsQuery = `SELECT 
                         username,tweet,date_time as dateTime 
                         FROM 
                         tweet inner join user on tweet.user_id = user.user_id 
                         WHERE 
                         tweet.user_id in (${getFollowerIdArray}) 
                         ORDER BY date_time DESC LIMIT 4`;
  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

//API-4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const username = request.username;
  const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
  const User = await db.get(getUserIdQuery);
  const userId = User.user_id;

  const getUserAsFollowerQuery = `SELECT * FROM user inner join follower on user.user_id = follower.follower_user_id where user_id ='${userId}'`;
  const follower = await db.all(getUserAsFollowerQuery);
  console.log(follower);
  /*[
  {
    user_id: 2,
    name: 'Joe Biden',
    username: 'JoeBiden',
    password: '$2b$10$2are6Ba69oi/Cai4aT/VM.t7AO7TsQx/.Ogz.7XG4qjuMil0v80aq',
    gender: 'male',
    follower_id: 4,
    follower_user_id: 2,
    following_user_id: 1
  },
  {
    user_id: 2,
    name: 'Joe Biden',
    username: 'JoeBiden',
    password: '$2b$10$2are6Ba69oi/Cai4aT/VM.t7AO7TsQx/.Ogz.7XG4qjuMil0v80aq',
    gender: 'male',
    follower_id: 5,
    follower_user_id: 2,
    following_user_id: 4
  }
] */
  const getUserFollowingIdArray = follower.map(
    (user_follower) => user_follower.following_user_id
  );
  console.log(getUserFollowingIdArray);
  const getFollowingUsersQuery = `SELECT 
                         user.name 
                         FROM 
                          user 
                         WHERE 
                         user_id in (${getUserFollowingIdArray}) `;
  const getFollowingUsers = await db.all(getFollowingUsersQuery);
  console.log(getFollowingUsers);
  response.send(getFollowingUsers);
});

//API-5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const username = request.username;
  const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
  const User = await db.get(getUserIdQuery);
  const userId = User.user_id;

  const getUserAsFollowingQuery = `SELECT * FROM user inner join follower on user.user_id = follower.following_user_id where user_id ='${userId}'`;
  const follower = await db.all(getUserAsFollowingQuery);
  console.log(follower);
  const getFollowersOfUserIdArray = follower.map(
    (user_follower) => user_follower.follower_user_id
  );

  const getFollowersOfUsersQuery = `SELECT 
                         user.name  
                         FROM
                          user 
                         WHERE 
                         user_id in (${getFollowersOfUserIdArray}) `;
  const getFollowersOfUsers = await db.all(getFollowersOfUsersQuery);
  console.log(getFollowersOfUsers);
  response.send(getFollowersOfUsers);
});

//API-6

// app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
//   const username = request.username;
//   const { tweetId } = request.params;
//   const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
//   const User = await db.get(getUserIdQuery);
//   const userId = User.user_id;
//   console.log(userId);
//   const getTweetedUserQuery = `
//    SELECT
//    *
//    FROM
//    tweet
//    WHERE
//    tweet_id='${tweetId}'`;
//   const TweetedUserDetails = await db.get(getTweetedUserQuery);
//   TweetedUserId = TweetedUserDetails.user_id;
//   console.log(TweetedUserId);

//   //checkingforfollowingcondition
//   const getFollowingUsersQuery = `SELECT
//                          *
//                          FROM
//                           follower
//                          WHERE
//                          follower_user_id ='${userId}' `;
//   const getFollowingUsers = await db.all(getFollowingUsersQuery);
//   const getFollowingUsersIdArray = getFollowingUsers.map(
//     (follower) => follower.following_user_id
//   );
//   console.log(getFollowingUsersIdArray);
//   is_following = getFollowingUsersIdArray.includes(TweetedUserId);
//   if (!is_following) {
//     response.status(401);
//     response.send("Invalid Request");
//   } else {
//     try {
//       const tweetQuery = `SELECT
//                             T.tweet as tweet ,
//                             count(T.reply) as replies,
//                             count(like.like_id) as likes,
//                             T.date_time as dateTime
//                             FROM (tweet
//                                 INNER JOIN reply
//                                 ON tweet.tweet_id=reply.tweet_id ) AS T
//                                     INNER JOIN  like
//                                     ON  T.tweet_id=like.tweet_id
//                                     WHERE T.tweet_id='${tweetId}'`;
//       const tweet = await db.all(tweetQuery);
//       console.log(tweet);
//       response.send(tweet);
//     } catch (err) {
//       console.log(err);
//     }
//   }
// });
app.get(
  "/tweets/:tweetId/",
  authenticateToken,
  follows,
  async (request, response) => {
    const { tweetId } = request.params;
    const { tweet, date_time } = await db.get(`
      select tweet,date_time from tweet where tweet_id = ${tweetId};`);
    const { likes } = await db.get(`
select count(like_id) as likes from like where tweet_id = ${tweetId};`);
    const { replies } = await db.get(`
select count(reply_id) as replies from reply where tweet_id = ${tweetId};`);
    response.send({ tweet, likes, replies, dateTime: date_time });
  }
);

//API-7
app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const username = request.username;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
    const User = await db.get(getUserIdQuery);
    const userId = User.user_id;
    console.log(userId);
    const getTweetedUserQuery = `
        SELECT
        *
        FROM 
        tweet
        WHERE
        tweet_id='${tweetId}'`;
    const TweetedUserDetails = await db.get(getTweetedUserQuery);
    TweetedUserId = TweetedUserDetails.user_id;
    console.log(TweetedUserId);

    //checkingforfollowingcondition
    const getFollowingUsersQuery = `SELECT 
                                *
                                FROM 
                                follower
                                WHERE 
                                follower_user_id ='${userId}' `;
    const getFollowingUsers = await db.all(getFollowingUsersQuery);
    const getFollowingUsersIdArray = getFollowingUsers.map(
      (follower) => follower.following_user_id
    );
    console.log(getFollowingUsersIdArray);
    is_following = getFollowingUsersIdArray.includes(TweetedUserId);
    if (!is_following) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const likedUsernameQuery = `
            SELECT
            user.username
            FROM user
            INNER JOIN  like ON user.user_id=like.user_id
            where like.tweet_id='${tweetId}'`;

      const likedUsersDetails = await db.all(likedUsernameQuery);
      const likedUsers = likedUsersDetails.map((user) => user.username);
      response.send({ likes: likedUsers });
    }
  }
);

//API-8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const username = request.username;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
    const User = await db.get(getUserIdQuery);
    const userId = User.user_id;
    console.log(userId);
    const getTweetedUserQuery = `
   SELECT
   *
   FROM 
   tweet
   WHERE
   tweet_id='${tweetId}'`;
    const TweetedUserDetails = await db.get(getTweetedUserQuery);
    TweetedUserId = TweetedUserDetails.user_id;
    console.log(TweetedUserId);

    //checkingforfollowingcondition
    const getFollowingUsersQuery = `SELECT 
                         *
                         FROM 
                          follower
                         WHERE 
                         follower_user_id ='${userId}' `;
    const getFollowingUsers = await db.all(getFollowingUsersQuery);
    const getFollowingUsersIdArray = getFollowingUsers.map(
      (follower) => follower.following_user_id
    );
    console.log(getFollowingUsersIdArray);
    is_following = getFollowingUsersIdArray.includes(TweetedUserId);
    if (!is_following) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      try {
        const repliesQuery = `SELECT 
                            user.name as name,
                            reply.reply as reply
                            FROM (reply
                                INNER JOIN user 
                                ON reply.user_id=user.user_id ) 
                                    WHERE reply.tweet_id='${tweetId}'`;
        const tweet = await db.all(repliesQuery);
        console.log(tweet);
        response.send({ replies: tweet });
      } catch (err) {
        console.log(err);
      }
    }
  }
);

//API-9
// app.get("/user/tweets/", authenticateToken, async (request, response) => {
//   const username = request.username;
//   const getUserIdQuery = `SELECT * FROM user WHERE username= '${username}' ;`;
//   const User = await db.get(getUserIdQuery);
//   const userId = User.user_id;
//   console.log(userId);

//   const tweetQuery = `SELECT
//                             T.tweet as tweet ,
//                             count(T.reply) as replies,
//                             count(like.like_id) as likes,
//                             T.date_time as dateTime
//                             FROM (tweet
//                                 LEFT JOIN reply
//                                 ON tweet.tweet_id=reply.tweet_id ) AS T
//                                     LEFT JOIN  like
//                                     ON  T.tweet_id=like.tweet_id
//                                     WHERE T.user_id='${userId}';
//                                 GROUP BY tweet.tweet_id    `;
//   const tweet = await db.all(tweetQuery);
//   console.log(tweet);
//   response.send(tweet);
// });
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const myTweets = await db.all(`
    select 
    tweet.tweet,
    count(distinct like.like_id) as likes,
    count(distinct reply.reply_id) as replies,
    tweet.date_time
    from
    tweet
    left join like on tweet.tweet_id = like.tweet_id
    left join reply on tweet.tweet_id = reply.tweet_id
    where tweet.user_id = (select user_id from user where username = "${request.username}")
    group by tweet.tweet_id;
    `);
  response.send(
    myTweets.map((item) => {
      const { date_time, ...rest } = item;
      return { ...rest, dateTime: date_time };
    })
  );
});

//API_10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const { user_id } = await db.get(
    `select user_id from user where username = "${request.username}"`
  );
  await db.run(`
    Insert into tweet
    (tweet, user_id)
    values
    ("${tweet}",${user_id});
    `);
  response.send("Created a Tweet");
});

//API_11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const userTweet = await db.get(`
  select 
  tweet_id, user_id
  from 
  tweet 
  where tweet_id = ${tweetId}
  and user_id = (select user_id from user where username = "${request.username}");
  `);
    if (userTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      await db.run(`
        DELETE FROM tweet
        WHERE tweet_id = ${tweetId}
        `);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
