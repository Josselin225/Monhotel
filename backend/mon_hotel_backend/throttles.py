from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class PublicBookingThrottle(AnonRateThrottle):
    scope = 'public_booking'


class PublicSearchThrottle(AnonRateThrottle):
    scope = 'public_search'


class MyBookingThrottle(AnonRateThrottle):
    scope = 'my_booking'
