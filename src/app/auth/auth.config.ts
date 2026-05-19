export const authApiConfig = {
  baseUrl: '/v1',
  loginEndpoint: '/auth/login',
  /**
   * Optional clinic UUID for `/booking` when `?clinic=` is omitted.
   * If unset, the app tries `GET /v1/clinic` first (must be public for anonymous visitors).
   * Set this to your clinic UUID if that endpoint requires auth.
   */
  publicBookingClinicId: undefined as string | undefined,
};
