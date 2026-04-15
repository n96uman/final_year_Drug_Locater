const Order = require('../models/Order')
const Medicine = require('../models/Medicine')

const recalc=(items)=>{ const s=items.map(i=>i.status); if(s.every(x=>x==='approved')) return 'approved'; if(s.every(x=>x==='rejected')) return 'rejected'; if(s.some(x=>x==='approved')) return 'partially_approved'; return 'pending' }
const belongs=(i,id,name)=> (i.pharmacyId && String(i.pharmacyId)===String(id)) || i.pharmacyName===name

exports.createOrder = async (req,res)=>{
  const final=[]
  for (const raw of req.body.items||[]){
    const qty=Number(raw.quantity); const med=await Medicine.findById(raw.medicineId)
    if(!med) return res.status(404).json({message:'Medicine not found'})
    if(med.quantity<qty) return res.status(400).json({message:`You cannot checkout ${qty} of ${med.name}. Only ${med.quantity} available.`})
    final.push({medicineId:med._id,pharmacyId:med.createdBy,medicineName:med.name,pharmacyName:med.pharmacyName,price:Number(med.price),quantity:qty,status:'pending'})
  }
  const subtotal=final.reduce((s,i)=>s+i.price*i.quantity,0),delivery=final.length?50:0,total=subtotal+delivery
  const order=await Order.create({customer:req.user._id,items:final,subtotal,delivery,total,status:'pending'})
  res.status(201).json({order,message:'Order placed and waiting pharmacy approval.'})
}

exports.getMyOrders = async (req,res)=> res.json({orders: await Order.find({customer:req.user._id}).sort({createdAt:-1})})
exports.getPharmacyOrders = async (req,res)=>{ const id=req.user._id; const orders=await Order.find({$or:[{'items.pharmacyId':id},{'items.pharmacyName':req.user.name}]}).populate('customer','name email').sort({createdAt:-1}); res.json({orders:orders.map(o=>({id:o._id,customer:o.customer,createdAt:o.createdAt,status:o.status,items:o.items.filter(i=>belongs(i,id,req.user.name))}))}) }

exports.approvePharmacyOrder = async (req,res)=>{ const id=req.user._id; const o=await Order.findById(req.params.orderId); if(!o) return res.status(404).json({message:'Order not found'}); const list=o.items.filter(i=>belongs(i,id,req.user.name)&&i.status==='pending'); if(!list.length) return res.status(400).json({message:'No pending items for this pharmacy in the selected order'}); for(const it of list){ const m=await Medicine.findById(it.medicineId); if(!m||m.quantity<it.quantity) return res.status(400).json({message:`Cannot approve ${it.medicineName}. Requested ${it.quantity}, available ${m?m.quantity:0}.`}) }
  for(const it of list){ await Medicine.updateOne({_id:it.medicineId,quantity:{$gte:it.quantity}},{$inc:{quantity:-it.quantity}}) }
  o.items=o.items.map(i=> belongs(i,id,req.user.name)&&i.status==='pending' ? {...i.toObject(),status:'approved',approvedAt:new Date()} : i ); o.status=recalc(o.items); await o.save(); res.json({message:'Order approved and stock updated.',order:o}) }

exports.rejectPharmacyOrder = async (req,res)=>{ const id=req.user._id; const o=await Order.findById(req.params.orderId); if(!o) return res.status(404).json({message:'Order not found'}); const has=o.items.some(i=>belongs(i,id,req.user.name)&&i.status==='pending'); if(!has) return res.status(400).json({message:'No pending items for this pharmacy in the selected order'}); o.items=o.items.map(i=> belongs(i,id,req.user.name)&&i.status==='pending' ? {...i.toObject(),status:'rejected'} : i ); o.status=recalc(o.items); await o.save(); res.json({message:'Order declined for this pharmacy.',order:o}) }
