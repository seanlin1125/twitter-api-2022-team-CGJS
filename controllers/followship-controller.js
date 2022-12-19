const { User, Followship, sequelize } = require('../models')
const helpers = require('../_helpers')

const followshipController = {
  addFollowing: (req, res, next) => {
    const followingId = Number(req.body.id)
    if (helpers.getUser(req).id === followingId) throw new Error('不能追蹤自己!')
    return Promise.all([
      User.findByPk(followingId),
      Followship.findOne({
        where: {
          followerId: helpers.getUser(req).id,
          followingId: followingId
        }
      })
    ])
      .then(([user, followship]) => {
        if (!user || user?.role === 'admin') throw new Error("User didn't exist!")
        if (followship) throw new Error('You are already following this user!')
        return Followship.create({
          followerId: helpers.getUser(req).id,
          followingId: followingId
        })
      })
      .then(newFollowship => res.json(newFollowship))
      .catch(err => next(err))
  },
  removeFollowing: (req, res, next) => {
    Followship.findOne({
      where: {
        followerId: helpers.getUser(req).id,
        followingId: req.params.followingId
      }
    })
      .then(followship => {
        if (!followship) throw new Error("You haven't followed this user!")
        return followship.destroy()
      })
      .then(deleteFollowship => res.json(deleteFollowship))
      .catch(err => next(err))
  },
  getTopUsers: (req, res, next) => {
    const currentUser = helpers.getUser(req)
    return User.findAll({
      attributes: {
        exclude: ['password'],
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM Followships WHERE Followships.followingId = User.id )'), 'followerCount'],
          [sequelize.literal(`EXISTS (SELECT id FROM Followships WHERE Followships.followerId = ${currentUser.id} AND Followships.followingId = User.id )`), 'isFollowing']
        ]
      },
      order: [
        [sequelize.literal('followerCount'), 'DESC'], ['createdAt', 'DESC']
      ],
      raw: true
    })
      .then(users => {
        const usersData = users.slice(0, 10)
        res.json(usersData)
      })
      .catch(err => next(err))
  }
}

module.exports = followshipController
