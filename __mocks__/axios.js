const mockPost = jest.fn(() => Promise.resolve({status: 200}))
const mockAxios = Object.assign(jest.fn(() => Promise.resolve()), {post: mockPost})

module.exports = {
  __esModule: true,
  default: mockAxios,
  isAxiosError: jest.fn(() => false),
}
