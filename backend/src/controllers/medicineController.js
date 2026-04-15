const Medicine = require('../models/Medicine')
exports.getMedicines = async (_r,res)=> res.json({medicines: await Medicine.find().sort({createdAt:-1})})
exports.getMine = async (req,res)=> res.json({medicines: await Medicine.find({createdBy:req.user._id}).sort({createdAt:-1})})
exports.create = async (req,res)=>{ const m=await Medicine.create({...req.body,createdBy:req.user._id}); res.status(201).json({medicine:m}) }
exports.update = async (req,res)=>{ const m=await Medicine.findById(req.params.id); if(!m) return res.status(404).json({message:'Not found'}); if(String(m.createdBy)!==String(req.user._id)) return res.status(403).json({message:'Forbidden'}); Object.assign(m,req.body); await m.save(); res.json({medicine:m}) }
exports.remove = async (req,res)=>{ const m=await Medicine.findById(req.params.id); if(!m) return res.status(404).json({message:'Not found'}); if(String(m.createdBy)!==String(req.user._id)) return res.status(403).json({message:'Forbidden'}); await m.deleteOne(); res.json({message:'Deleted'}) }
