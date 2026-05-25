const Medicine = require('../models/Medicine')
const User = require('../models/User')
exports.getMedicines = async (_req, res) => {
  const approvedOwners = await User.find({
    role: 'pharmacy',
    $or: [{ pharmacyApprovalStatus: 'approved' }, { pharmacyApprovalStatus: { $exists: false } }],
  }).distinct('_id')
  const medicines = await Medicine.find({ createdBy: { $in: approvedOwners } }).populate('createdBy', 'location locationLat locationLng').sort({ createdAt: -1 })
  res.json({
    medicines: medicines.map((m) => {
      const obj = m.toObject()
      return {
        ...obj,
        createdBy: obj.createdBy?._id || obj.createdBy,
        pharmacyLocation: obj.createdBy?.location || '',
        pharmacyLat: obj.createdBy?.locationLat ?? null,
        pharmacyLng: obj.createdBy?.locationLng ?? null,
      }
    }),
  })
}
exports.getMine = async (req,res)=> res.json({medicines: await Medicine.find({createdBy:req.user._id}).sort({createdAt:-1})})
exports.create = async (req,res)=>{ const m=await Medicine.create({...req.body,createdBy:req.user._id}); res.status(201).json({medicine:m}) }
exports.update = async (req,res)=>{ const m=await Medicine.findById(req.params.id); if(!m) return res.status(404).json({message:'Not found'}); if(String(m.createdBy)!==String(req.user._id)) return res.status(403).json({message:'Forbidden'}); Object.assign(m,req.body); await m.save(); res.json({medicine:m}) }
exports.remove = async (req,res)=>{ const m=await Medicine.findById(req.params.id); if(!m) return res.status(404).json({message:'Not found'}); if(String(m.createdBy)!==String(req.user._id)) return res.status(403).json({message:'Forbidden'}); await m.deleteOne(); res.json({message:'Deleted'}) }
