export const supabase = new Proxy({}, {
  get() { throw new Error("Manager focused browser fixture must not contact Supabase"); },
});
