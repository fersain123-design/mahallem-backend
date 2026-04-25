import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/adminService';
import {
  RejectVendorSchema,
  DeactivateVendorSchema,
  UpdateOrderStatusSchema,
  CreateVendorViolationSchema,
  ReviewVendorDocumentSchema,
  RejectProductForPricingSchema,
} from '../utils/validationSchemas';

export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dashboard = await adminService.getAdminDashboard();
    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};

// Vendors
export const getVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, search, page, limit, ibanStatusIn } = req.query;

    const ibanStatuses = (() => {
      if (!ibanStatusIn) return undefined;
      if (Array.isArray(ibanStatusIn)) return ibanStatusIn.map(String).filter(Boolean);
      return String(ibanStatusIn)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    })();

    const result = await adminService.getVendors(
      status as string | undefined,
      search as string | undefined,
      ibanStatuses,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const approveVendorIban = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendor = await adminService.approveVendorIban(id);
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
};

export const openVendorIbanChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendor = await adminService.openVendorIbanChange(id);
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
};

export const getVendorById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendor = await adminService.getVendorById(id);
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
};

export const approveVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('📝 Vendor approval request, ID:', id);
    const vendor = await adminService.approveVendor(id);
    console.log('✅ Vendor approved successfully:', vendor.id);
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    console.error('❌ Vendor approval error:', error);
    next(error);
  }
};

export const rejectVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = RejectVendorSchema.parse(req.body);
    console.log('📝 Vendor rejection request, ID:', id, 'Reason:', data.rejectionReason);
    const vendor = await adminService.rejectVendor(id, data.rejectionReason);
    console.log('✅ Vendor rejected successfully:', vendor.id);
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    console.error('❌ Vendor rejection error:', error);
    next(error);
  }
};

export const deactivateVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = DeactivateVendorSchema.parse(req.body);
    const result = await adminService.deactivateVendor(id, data.reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const suspendVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = DeactivateVendorSchema.parse(req.body);
    const result = await adminService.suspendVendor(id, data.reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const unsuspendVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await adminService.unsuspendVendor(id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const reviewVendorDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = ReviewVendorDocumentSchema.parse(req.body);
    const updated = await adminService.reviewVendorDocument(id, data);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const getVendorViolations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const violations = await adminService.getVendorViolations(id);
    res.status(200).json({ success: true, data: violations });
  } catch (error) {
    next(error);
  }
};

export const createVendorViolation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const data = CreateVendorViolationSchema.parse(req.body);
    const created = await adminService.createVendorViolation(
      req.user.userId,
      id,
      data
    );
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

// Users
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role, search, page, limit } = req.query;
    const result = await adminService.getUsers(
      role as string | undefined,
      search as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await adminService.getUserById(id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const suspendUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = DeactivateVendorSchema.parse(req.body);
    const user = await adminService.suspendUser(id, data.reason);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const unsuspendUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await adminService.unsuspendUser(id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// Customers (sadece CUSTOMER rolündeki kullanıcıları getirir)
export const getCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, page, limit } = req.query;
    const result = await adminService.getCustomers(
      search as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Products
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { isActive, approvalStatus, categorySlug, search, page, limit } = req.query;
    const normalizedApprovalStatus =
      typeof approvalStatus === 'string'
        ? approvalStatus.toUpperCase()
        : undefined;
    const result = await adminService.getProducts(
      isActive ? isActive === 'true' : undefined,
      normalizedApprovalStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
      categorySlug as string | undefined,
      search as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getUncategorizedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, page, limit } = req.query;
    const result = await adminService.getUncategorizedProducts(
      search as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const bulkAssignProductSubCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productIds, subCategoryId, autoMatch } = req.body || {};
    const result = await adminService.bulkAssignProductSubCategories({
      productIds,
      subCategoryId,
      autoMatch,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const toggleProductActive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await adminService.toggleProductActive(id);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const setProductActive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, message: 'isActive must be a boolean' });
      return;
    }

    const product = await adminService.setProductActive(id, isActive);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteProductByAdmin(id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const rejectProductForPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const payload = RejectProductForPricingSchema.parse(req.body || {});
    const product = await adminService.rejectProductForPricing(
      id,
      payload.reasonMessage,
      payload.reasonTitle
    );
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Orders
export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, vendorId, customerId, cancelReason, paymentStatus, page, limit } = req.query;
    const result = await adminService.getOrders(
      status as string | undefined,
      vendorId as string | undefined,
      customerId as string | undefined,
      cancelReason as string | undefined,
      paymentStatus as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await adminService.getOrderById(id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = UpdateOrderStatusSchema.parse(req.body);
    const order = await adminService.updateOrderStatus(id, data.status);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// Payouts
export const getPayouts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, page, limit } = req.query;
    const result = await adminService.getPayouts(
      status as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPayoutById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const payout = await adminService.getPayoutById(id);
    res.status(200).json({ success: true, data: payout });
  } catch (error) {
    next(error);
  }
};

export const markPayoutAsPaid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const payout = await adminService.markPayoutAsPaid(id);
    res.status(200).json({ success: true, data: payout });
  } catch (error) {
    next(error);
  }
};

// Notifications
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit } = req.query;
    const userId = req.user!.userId;

    const notifications = await adminService.getNotifications(
      userId,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

export const createNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, message, type, targetUsers, targetAudience, target_audience } = req.body;
    const userId = req.user!.userId;

    const notification = await adminService.createNotification(
      userId,
      title,
      message,
      type,
      targetUsers,
      targetAudience || target_audience
    );
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const notification = await adminService.markNotificationAsRead(id, userId);
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};
