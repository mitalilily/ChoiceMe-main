import {
  ViewIcon,
  ViewOffIcon,
} from '@chakra-ui/icons'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import {
  useAdminEmployees,
  useCreateAdminEmployeeMutation,
  useDeleteAdminEmployeeMutation,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} from 'hooks/useAdminEmployees'
import { useMemo, useState } from 'react'
import { FiEdit2, FiPlus, FiRefreshCw, FiTrash } from 'react-icons/fi'
import { ADMIN_PERMISSION_PAGES } from 'utils/adminPermissions'

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  role: 'employee',
  password: '',
  moduleAccess: {},
}

const roleOptions = [
  { label: 'Employee', value: 'employee' },
  { label: 'Manager', value: 'manager' },
  { label: 'Support', value: 'support' },
  { label: 'Operations', value: 'operations' },
  { label: 'Finance', value: 'finance' },
]

const groupedPages = ADMIN_PERMISSION_PAGES.reduce((groups, page) => {
  groups[page.group] = groups[page.group] || []
  groups[page.group].push(page)
  return groups
}, {})

const normalizeAccess = (access) => {
  if (!access || typeof access !== 'object') return {}
  return Object.entries(access).reduce((acc, [key, value]) => {
    acc[key] =
      value === true
        ? { read: true, edit: true }
        : {
            read: Boolean(value?.read || value?.edit),
            edit: Boolean(value?.edit),
          }
    return acc
  }, {})
}

const AdminUsersPage = () => {
  const toast = useToast()
  const cardBg = useColorModeValue('white', 'gray.700')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingMember, setEditingMember] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [showPassword, setShowPassword] = useState(true)

  const modal = useDisclosure()
  const { data, isLoading, isFetching, refetch } = useAdminEmployees(page, limit, filters)
  const createMutation = useCreateAdminEmployeeMutation()
  const updateMutation = useUpdateAdminEmployeeMutation()
  const statusMutation = useUpdateAdminEmployeeStatusMutation()
  const deleteMutation = useDeleteAdminEmployeeMutation()

  const employees = data?.employees || []
  const totalCount = data?.totalCount || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  const permissionCount = useMemo(
    () =>
      Object.values(form.moduleAccess || {}).filter((permission) => permission?.read || permission?.edit)
        .length,
    [form.moduleAccess],
  )

  const openCreate = () => {
    setEditingMember(null)
    setForm(defaultForm)
    setShowPassword(true)
    modal.onOpen()
  }

  const openEdit = (member) => {
    setEditingMember(member)
    setForm({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'employee',
      password: '',
      moduleAccess: normalizeAccess(member.moduleAccess),
    })
    setShowPassword(false)
    modal.onOpen()
  }

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const setPermission = (key, mode, checked) => {
    setForm((prev) => {
      const next = { ...(prev.moduleAccess || {}) }
      const current = { ...(next[key] || {}) }

      if (mode === 'read') {
        current.read = checked
        if (!checked) current.edit = false
      } else {
        current.edit = checked
        if (checked) current.read = true
      }

      if (!current.read && !current.edit) {
        delete next[key]
      } else {
        next[key] = current
      }

      return { ...prev, moduleAccess: next }
    })
  }

  const applyGroup = (pages, mode) => {
    setForm((prev) => {
      const next = { ...(prev.moduleAccess || {}) }
      pages.forEach((page) => {
        next[page.key] = mode === 'edit' ? { read: true, edit: true } : { read: true, edit: false }
      })
      return { ...prev, moduleAccess: next }
    })
  }

  const clearGroup = (pages) => {
    setForm((prev) => {
      const next = { ...(prev.moduleAccess || {}) }
      pages.forEach((page) => delete next[page.key])
      return { ...prev, moduleAccess: next }
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Name and email are required', status: 'warning', isClosable: true })
      return
    }
    if (!editingMember && form.password.trim().length < 6) {
      toast({ title: 'Password must be at least 6 characters', status: 'warning', isClosable: true })
      return
    }

    const payload = {
      ...form,
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      moduleAccess: form.moduleAccess || {},
    }
    if (editingMember && !payload.password) delete payload.password

    try {
      if (editingMember) {
        await updateMutation.mutateAsync({ memberId: editingMember.id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      toast({
        title: editingMember ? 'Admin user updated' : 'Admin user created',
        status: 'success',
        isClosable: true,
      })
      modal.onClose()
      setForm(defaultForm)
      setEditingMember(null)
    } catch (error) {
      toast({
        title: 'Action failed',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
      })
    }
  }

  const toggleStatus = async (member) => {
    try {
      await statusMutation.mutateAsync({ memberId: member.id, isActive: !member.isActive })
      toast({ title: 'Status updated', status: 'success', isClosable: true })
    } catch (error) {
      toast({
        title: 'Status update failed',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
      })
    }
  }

  const deleteMember = async (member) => {
    if (!window.confirm(`Delete ${member.name || member.email}?`)) return
    try {
      await deleteMutation.mutateAsync(member.id)
      toast({ title: 'Admin user deleted', status: 'success', isClosable: true })
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
      })
    }
  }

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      <Flex justify="space-between" align="center" mb={6} gap={4} wrap="wrap">
        <Box>
          <Heading size="lg">Admin User Management</Heading>
          <Text fontSize="sm" color="gray.500">
            Create admin employees and control read/edit access for each page.
          </Text>
        </Box>
        <HStack>
          <Button leftIcon={<FiRefreshCw />} variant="outline" onClick={refetch} isLoading={isFetching}>
            Refresh
          </Button>
          <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={openCreate}>
            Create User
          </Button>
        </HStack>
      </Flex>

      <Box bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={4} mb={4}>
        <Grid templateColumns={{ base: '1fr', md: '2fr 1fr auto' }} gap={3} alignItems="end">
          <FormControl>
            <FormLabel>Search</FormLabel>
            <Input
              placeholder="Name, email, or phone"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Status</FormLabel>
            <Select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormControl>
          <Button onClick={() => setPage(1)}>Apply</Button>
        </Grid>
      </Box>

      <Box bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Permissions</Th>
              <Th>Status</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {employees.map((member) => {
              const moduleAccess = normalizeAccess(member.moduleAccess)
              const count = Object.values(moduleAccess).filter((item) => item.read || item.edit).length
              return (
                <Tr key={member.id}>
                  <Td fontWeight="700">{member.name}</Td>
                  <Td>{member.email}</Td>
                  <Td><Badge colorScheme="purple">{member.role}</Badge></Td>
                  <Td>{count} pages</Td>
                  <Td>
                    <HStack>
                      <Switch isChecked={Boolean(member.isActive)} onChange={() => toggleStatus(member)} />
                      <Badge colorScheme={member.isActive ? 'green' : 'red'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </HStack>
                  </Td>
                  <Td textAlign="right">
                    <HStack justify="flex-end">
                      <IconButton aria-label="Edit" icon={<FiEdit2 />} size="sm" onClick={() => openEdit(member)} />
                      <IconButton
                        aria-label="Delete"
                        icon={<FiTrash />}
                        size="sm"
                        colorScheme="red"
                        variant="outline"
                        onClick={() => deleteMember(member)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
        {!isLoading && employees.length === 0 && (
          <Text p={6} textAlign="center" color="gray.500">
            No admin users found.
          </Text>
        )}
      </Box>

      <Flex justify="space-between" align="center" mt={4}>
        <Text fontSize="sm" color="gray.500">
          {totalCount} users
        </Text>
        <HStack>
          <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={page === 1}>
            Previous
          </Button>
          <Text fontSize="sm">Page {page} of {totalPages}</Text>
          <Button size="sm" onClick={() => setPage((p) => p + 1)} isDisabled={page >= totalPages}>
            Next
          </Button>
          <Select size="sm" w="90px" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </Select>
        </HStack>
      </Flex>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingMember ? 'Edit Admin User' : 'Create Admin User'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={5}>
              <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>
                  <Input value={form.name} onChange={(e) => setField('name', e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Role Label</FormLabel>
                  <Select value={form.role} onChange={(e) => setField('role', e.target.value)}>
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired={!editingMember}>
                  <FormLabel>{editingMember ? 'New Password' : 'Password'}</FormLabel>
                  <InputGroup>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      placeholder={editingMember ? 'Leave blank to keep unchanged' : 'Minimum 6 characters'}
                      onChange={(e) => setField('password', e.target.value)}
                      pr="44px"
                    />
                    <InputRightElement>
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowPassword((value) => !value)}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                <Box alignSelf="end">
                  <Badge colorScheme="blue" px={3} py={1} borderRadius="full">
                    {permissionCount} pages assigned
                  </Badge>
                </Box>
              </Grid>

              <Box>
                <Heading size="sm" mb={3}>Page Permissions</Heading>
                <Stack spacing={4}>
                  {Object.entries(groupedPages).map(([group, pages]) => (
                    <Box key={group} borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={4}>
                      <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
                        <Heading size="xs">{group}</Heading>
                        <HStack>
                          <Button size="xs" variant="outline" onClick={() => applyGroup(pages, 'read')}>Read all</Button>
                          <Button size="xs" variant="outline" onClick={() => applyGroup(pages, 'edit')}>Edit all</Button>
                          <Button size="xs" variant="ghost" onClick={() => clearGroup(pages)}>Clear</Button>
                        </HStack>
                      </Flex>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Page</Th>
                            <Th w="120px">Read</Th>
                            <Th w="120px">Edit</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {pages.map((page) => {
                            const permission = form.moduleAccess?.[page.key] || {}
                            return (
                              <Tr key={page.key}>
                                <Td>{page.label}</Td>
                                <Td>
                                  <Checkbox
                                    isChecked={Boolean(permission.read || permission.edit)}
                                    onChange={(e) => setPermission(page.key, 'read', e.target.checked)}
                                  />
                                </Td>
                                <Td>
                                  <Checkbox
                                    isChecked={Boolean(permission.edit)}
                                    onChange={(e) => setPermission(page.key, 'edit', e.target.checked)}
                                  />
                                </Td>
                              </Tr>
                            )
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={modal.onClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingMember ? 'Save Changes' : 'Create User'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default AdminUsersPage
