export interface SubmittedCustomerPayment {
  payment_id: string;
  order_id: string;
  amount: number | string;
  payment_method: "gcash";
  gcash_reference_number: string;
  proof_image_path: string;
  status: "pending";
  created_at: string;
}
