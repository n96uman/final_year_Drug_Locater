const mongoose = require('mongoose')
const schema = new mongoose.Schema({name:String,genericName:String,pharmacyName:String,price:Number,quantity:Number,expiry:String,createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true})
module.exports = mongoose.model('Medicine', schema)
