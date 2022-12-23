const { Tweet, User, Like, Reply, sequelize } = require('../models')
const helpers = require('../_helpers')
const { dateFormat } = require('../helpers/date-helper')

const tweetController = {
  // 新增推文：
  postTweet: (req, res, next) => {
    const { description } = req.body
    if (!description?.trim()) throw new Error('內容不可空白!')
    if (description?.length > 140) throw new Error('推文字數限制在 140 以內!')
    return Tweet.create({
      UserId: helpers.getUser(req).id,
      description
    })
      .then(newTweet =>
        res.json(newTweet)
      )
      .catch(err => next(err))
  },
  // 取得所有推文：
  getTweets: (req, res, next) => {
    const currentUser = helpers.getUser(req)
    return Tweet.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'account', 'name', 'avatar']
        }],
      attributes: {
        exclude: ['updatedAt'], // 如果把createdAt也拿掉，會影響到下面relativeTime的呈現時間
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM Replies WHERE Replies.TweetId = Tweet.id )'), 'replyCount'],
          [sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.TweetId = Tweet.id )'), 'likeCount'],
          [sequelize.literal(`EXISTS (SELECT id FROM Likes WHERE Likes.UserId = ${currentUser.id} AND Likes.TweetId = Tweet.id )`), 'isLiked']
        ]
      },
      order: [['createdAt', 'DESC']],
      raw: true,
      nest: true
    })
      .then(tweets => {
        return tweets.map(tweet => ({
          ...tweet,
          relativeTime: dateFormat(tweet.createdAt).fromNow()
        }))
      })
      .then(tweets =>
        res.json(tweets)
      )
      .catch(err => next(err))
  },
  // 取得一則推文：
  getTweet: (req, res, next) => {
    const currentUser = helpers.getUser(req)
    return Tweet.findByPk(req.params.tweet_id, {
      include: [
        {
          model: User,
          attributes: ['id', 'account', 'name', 'avatar']
        }],
      attributes: {
        exclude: ['updatedAt'],
        include: [
          'id', 'UserId', 'description',
          [sequelize.literal('(SELECT COUNT(*) FROM Replies WHERE Replies.TweetId = Tweet.id )'), 'replyCount'],
          [sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.TweetId = Tweet.id )'), 'likeCount'],
          [sequelize.literal(`EXISTS (SELECT id FROM Likes WHERE Likes.UserId = ${currentUser.id} AND Likes.TweetId = Tweet.id )`), 'isLiked']
        ]
      },
      order: [['createdAt', 'DESC']],
      raw: true,
      nest: true
    })
      .then(tweet => {
        if (!tweet) {
          const err = new Error('推文不存在!')
          err.status = 404
          throw err
        }
        const tweetAddTime = {
          ...tweet,
          exactTime: dateFormat(tweet.createdAt).format('A hh:mm YYYY年 MMM DD日'),
          relativeTime: dateFormat(tweet.createdAt).fromNow()
        }
        return res.json(tweetAddTime)
      })
      .catch(err => next(err))
  },
  // 將推文加入喜歡
  addLike: (req, res, next) => {
    const currentUser = helpers.getUser(req)
    const TweetId = req.params.id
    return Promise.all([
      Tweet.findByPk(TweetId, { raw: true }),
      Like.findOne({
        where: {
          UserId: currentUser.id,
          TweetId
        }
      })
    ])
      .then(([tweet, like]) => {
        if (!tweet) throw new Error('推文不存在!')
        if (tweet.UserId === currentUser.id) throw new Error('不能按讚自己的推文!')
        if (like) throw new Error('你已經按讚此推文了!')
        return Like.create({
          UserId: currentUser.id,
          TweetId
        })
      })
      .then(newLike =>
        res.json(newLike)
      )
      .catch(err => next(err))
  },
  // 將推文移除喜歡
  removeLike: (req, res, next) => {
    return Like.findOne({
      where: {
        UserId: helpers.getUser(req).id,
        TweetId: req.params.id
      }
    })
      .then(like => {
        if (!like) throw new Error('你還沒按讚此推文!')

        return like.destroy()
      })
      .then(newUnlike => res.json(newUnlike))
      .catch(err => next(err))
  },
  // 新增推文回覆
  postReply: (req, res, next) => {
    const TweetId = req.params.tweet_id
    const UserId = helpers.getUser(req).id
    const { comment } = req.body
    if (!comment?.trim()) throw new Error('內容不可空白!')
    return Promise.all([
      User.findByPk(UserId),
      Tweet.findByPk(TweetId)
    ])
      .then(([user, tweet]) => {
        if (!user) throw new Error('使用者不存在!')
        if (!tweet) throw new Error('推文不存在!')
        return Reply.create({
          comment,
          TweetId,
          UserId
        })
      })
      .then(newReply => {
        res.json(newReply)
      })
      .catch(err => next(err))
  },
  // 該則推文的所有回覆
  getReplies: (req, res, next) => {
    return Reply.findAll({
      where: { TweetId: req.params.tweet_id },
      attributes: { exclude: ['updatedAt'] },
      include: [
        {
          model: User,
          attributes: ['id', 'account', 'name', 'avatar']
        },
        {
          model: Tweet,
          attributes: ['UserId'],
          include: {
            model: User,
            attributes: ['account']
          }
        }
      ],
      order: [['createdAt', 'DESC']],
      raw: true,
      nest: true
    })
      .then(replies => {
        return replies
          .map(reply => ({
            ...reply,
            relativeTime: dateFormat(reply.createdAt).fromNow()
          }))
      })
      .then(replies => {
        if (!replies) throw new Error('留言回覆不存在!')
        return res.json(replies)
      })
      .catch(err => next(err))
  }
}

module.exports = tweetController
