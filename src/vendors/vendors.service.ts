import { Injectable, Inject, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class VendorsService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  // ── Update Details ─────────────────────────────────────────────────────────
  async updateDetails(vendorId: string, details: any) {
    try {
      const {
        companyName, contactPerson, phone, email,
        businessType, gstNumber,
        // New fields from 7-step onboarding
        serviceTypes, bio, profilePhoto,
        location,
        documents,
        bankDetails,
      } = details;

      const hasMainFields = companyName || contactPerson || phone || email ||
        businessType || gstNumber || serviceTypes || bio || profilePhoto || location;

      if (hasMainFields) {
        await this.pool.query(
          `UPDATE vendors SET
            company_name     = COALESCE($1,  company_name),
            contact_person   = COALESCE($2,  contact_person),
            phone            = COALESCE($3,  phone),
            email            = COALESCE($4,  email),
            business_type    = COALESCE($5,  business_type),
            gst_number       = COALESCE($6,  gst_number),
            service_types    = COALESCE($7,  service_types),
            bio              = COALESCE($8,  bio),
            profile_photo    = COALESCE($9,  profile_photo),
            location         = COALESCE($10, location)
          WHERE id = $11`,
          [
            companyName, contactPerson, phone, email,
            businessType, gstNumber,
            serviceTypes || null,
            bio,
            profilePhoto,
            location ? JSON.stringify(location) : null,
            vendorId,
          ]
        );
      }

      if (documents) {
        await this.uploadDocuments(vendorId, documents);
      }

      if (bankDetails) {
        await this.updateBankDetails(vendorId, bankDetails);
      }

      return this.getProfile(vendorId);
    } catch (error) {
      console.error('Update details error:', error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update vendor details');
    }
  }

  // ── Bank Details ──────────────────────────────────────────────────────────
  async updateBankDetails(vendorId: string, bankDetails: any) {
    try {
      const {
        accountHolderName, bankName, accountNumber, ifscCode, chequeFile, chequeUrl, upiId,
        holderName,
        // snake_case support
        account_holder_name, bank_name, account_number, ifsc_code, cheque_file, upi_id,
      } = bankDetails;

      const ahn = accountHolderName || account_holder_name || holderName;
      const bn  = bankName         || bank_name;
      const an  = accountNumber    || account_number;
      const ic  = ifscCode         || ifsc_code;
      const cf  = chequeFile       || cheque_file || chequeUrl;
      const upi = upiId            || upi_id;

      const existing = await this.pool.query(
        'SELECT id FROM vendor_bank_details WHERE vendor_id = $1', [vendorId]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await this.pool.query(
          `UPDATE vendor_bank_details SET
            account_holder_name = COALESCE($1, account_holder_name),
            bank_name           = COALESCE($2, bank_name),
            account_number      = COALESCE($3, account_number),
            ifsc_code           = COALESCE($4, ifsc_code),
            cheque_file         = COALESCE($5, cheque_file),
            upi_id              = COALESCE($6, upi_id)
          WHERE vendor_id = $7 RETURNING *`,
          [ahn, bn, an, ic, cf, upi, vendorId]
        );
      } else {
        result = await this.pool.query(
          `INSERT INTO vendor_bank_details
            (vendor_id, account_holder_name, bank_name, account_number, ifsc_code, cheque_file, upi_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [vendorId, ahn, bn, an, ic, cf, upi]
        );
      }
      return result.rows[0];
    } catch (error) {
      throw new InternalServerErrorException('Failed to update bank details');
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  async uploadDocuments(vendorId: string, documents: any) {
    try {
      const {
        // Old fields (step2 KYC)
        company_registration, pan_card, gst_certificate, owner_id, address_proof,
        companyRegistration, panCard, gstCertificate, ownerId, addressProof,
        // New fields (step4 Verify)
        government_id, selfie, business_registration,
        governmentId, selfieUrl, businessRegistration,
      } = documents;

      const cr  = company_registration || companyRegistration;
      const pc  = pan_card             || panCard;
      const gc  = gst_certificate      || gstCertificate;
      const oi  = owner_id             || ownerId;
      const ap  = address_proof        || addressProof;
      const gid = government_id        || governmentId;
      const sf  = selfie               || selfieUrl;
      const br  = business_registration || businessRegistration;

      const existing = await this.pool.query(
        'SELECT id FROM vendor_documents WHERE vendor_id = $1', [vendorId]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await this.pool.query(
          `UPDATE vendor_documents SET
            company_registration    = COALESCE($1,  company_registration),
            pan_card                = COALESCE($2,  pan_card),
            gst_certificate         = COALESCE($3,  gst_certificate),
            owner_id                = COALESCE($4,  owner_id),
            address_proof           = COALESCE($5,  address_proof),
            government_id           = COALESCE($6,  government_id),
            selfie                  = COALESCE($7,  selfie),
            business_registration   = COALESCE($8,  business_registration)
          WHERE vendor_id = $9 RETURNING *`,
          [cr, pc, gc, oi, ap, gid, sf, br, vendorId]
        );
      } else {
        result = await this.pool.query(
          `INSERT INTO vendor_documents
            (vendor_id, company_registration, pan_card, gst_certificate,
             owner_id, address_proof, government_id, selfie, business_registration)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [vendorId, cr, pc, gc, oi, ap, gid, sf, br]
        );
      }
      return result.rows[0];
    } catch (error) {
      console.error('Error uploading documents:', error);
      throw new InternalServerErrorException('Failed to upload documents');
    }
  }

  // ── Get Profile ───────────────────────────────────────────────────────────
  async getProfile(vendorId: string) {
    try {
      const vendor = await this.pool.query(
        'SELECT * FROM vendors WHERE id = $1', [vendorId]
      );
      if (vendor.rows.length === 0) throw new NotFoundException('Vendor not found');

      const documents  = await this.pool.query(
        'SELECT * FROM vendor_documents WHERE vendor_id = $1', [vendorId]
      );
      const bankDetails = await this.pool.query(
        'SELECT * FROM vendor_bank_details WHERE vendor_id = $1', [vendorId]
      );

      const v = vendor.rows[0];
      return {
        ...v,
        // Parse JSONB fields back for Flutter
        service_types: v.service_types ?? [],
        location:      v.location      ?? null,
        documents:     documents.rows[0]   || null,
        bankDetails:   bankDetails.rows[0] || null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to get vendor profile');
    }
  }

  async getProfileByUserId(userId: string) {
    try {
      const vendor = await this.pool.query(
        'SELECT * FROM vendors WHERE user_id = $1', [userId]
      );
      if (vendor.rows.length === 0) throw new NotFoundException('Vendor not found');
      return this.getProfile(vendor.rows[0].id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to get vendor profile by user id');
    }
  }

  async updateDetailsByUserId(userId: string, details: any) {
    const vendor = await this.pool.query(
      'SELECT id FROM vendors WHERE user_id = $1', [userId]
    );
    if (vendor.rows.length === 0) throw new NotFoundException('Vendor not found');
    return this.updateDetails(vendor.rows[0].id, details);
  }

  async updateBankDetailsByUserId(userId: string, bankDetails: any) {
    const vendor = await this.pool.query(
      'SELECT id FROM vendors WHERE user_id = $1', [userId]
    );
    if (vendor.rows.length === 0) throw new NotFoundException('Vendor not found');
    return this.updateBankDetails(vendor.rows[0].id, bankDetails);
  }

  async updateDocumentsByUserId(userId: string, documents: any) {
    const vendor = await this.pool.query(
      'SELECT id FROM vendors WHERE user_id = $1', [userId]
    );
    if (vendor.rows.length === 0) throw new NotFoundException('Vendor not found');
    return this.uploadDocuments(vendor.rows[0].id, documents);
  }

  async updateOnboardingStatus(vendorId: string, currentStep: number, status?: string) {
    try {
      const query = status
        ? 'UPDATE vendors SET current_step = $1, onboarding_status = $2 WHERE id = $3 RETURNING *'
        : 'UPDATE vendors SET current_step = $1 WHERE id = $2 RETURNING *';
      const params = status ? [currentStep, status, vendorId] : [currentStep, vendorId];
      const result = await this.pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw new InternalServerErrorException('Failed to update onboarding status');
    }
  }

  async updateOnboardingStatusByUserId(userId: string, currentStep: number, status?: string) {
    const vendor = await this.pool.query(
      'SELECT id FROM vendors WHERE user_id = $1', [userId]
    );
    if (vendor.rows.length === 0) throw new NotFoundException('Vendor not found');
    return this.updateOnboardingStatus(vendor.rows[0].id, currentStep, status);
  }
}
