var mongoose = require('mongoose');

module.exports = {
  userSchema : mongoose.Schema({
      name: {type: String, required: true},
      phoneNumber: {type: Number, required: true}
  }),
  itemSchema : mongoose.Schema({
      name: {type: String, required: true}
  })
}
