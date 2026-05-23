export function redirectAfterAuth(user, navigate, fromPath) {
  if (user.role === 'admin') {
    navigate('/admin', { replace: true })
    return
  }
  if (user.role === 'pharmacy') {
    if (user.pharmacyApprovalStatus && user.pharmacyApprovalStatus !== 'approved') {
      navigate('/pharmacy-pending', { replace: true })
      return
    }
    if (!String(user.location || '').trim()) {
      navigate('/pharmacy-location', { replace: true })
      return
    }
    navigate('/pharmacy-dashboard', { replace: true })
    return
  }
  navigate(fromPath || '/', { replace: true })
}

export function pharmacyNeedsLocation(user) {
  return user?.role === 'pharmacy' && user.pharmacyApprovalStatus === 'approved' && !String(user.location || '').trim()
}
