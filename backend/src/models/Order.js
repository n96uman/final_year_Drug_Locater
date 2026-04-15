const mongoose = require('mongoose')
const item = new mongoose.Schema({medicineId:{type:mongoose.Schema.Types.ObjectId,ref:'Medicine'},pharmacyId:{type:mongoose.Schema.Types.ObjectId,ref:'User'},medicineName:String,pharmacyName:String,price:Number,quantity:Number,status:{type:String,enum:['pending','approved','rejected'],default:'pending'}},{_id:false})
const schema = new mongoose.Schema({customer:{type:mongoose.Schema.Types.ObjectId,ref:'User'},items:[item],subtotal:Number,delivery:Number,total:Number,status:{type:String,enum:['pending','partially_approved','approved','rejected'],default:'pending'}},{timestamps:true})
module.exports = mongoose.model('Order', schema)
