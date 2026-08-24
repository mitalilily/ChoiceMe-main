import api from './axios'

export async function fetchAdminAccess() {
  const response = await api.get('/admin/users/employees/me')
  return response.data
}

export async function fetchAdminEmployees(page = 1, limit = 20, filters = {}) {
  const response = await api.get('/admin/users/employees', {
    params: { page, limit, ...filters },
  })
  return response.data
}

export async function createAdminEmployee(payload) {
  const response = await api.post('/admin/users/employees', payload)
  return response.data
}

export async function updateAdminEmployee(memberId, payload) {
  const response = await api.patch(`/admin/users/employees/${memberId}`, payload)
  return response.data
}

export async function updateAdminEmployeeStatus(memberId, isActive) {
  const response = await api.patch(`/admin/users/employees/${memberId}/status`, { isActive })
  return response.data
}

export async function deleteAdminEmployee(memberId) {
  const response = await api.delete(`/admin/users/employees/${memberId}`)
  return response.data
}
