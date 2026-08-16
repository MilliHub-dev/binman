import type { Request, Response } from 'express';
import { created, ok, param } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import { submitProofSchema } from './driver.schema';
import * as service from './driver.service';

export const home = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.getDriverHome(user.id));
};

export const listJobs = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { scope, date } = req.query as unknown as { scope: string; date?: string };
  return ok(res, await service.listJobs(user.id, scope, date));
};

export const getJob = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.getJob(user.id, param(req, 'id')));
};

export const accept = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.acceptJob(user.id, param(req, 'id')), 'Job accepted');
};

export const updateStatus = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const body = req.body as { status: never; latitude?: number; longitude?: number };
  const job = await service.updateJobStatus(user.id, param(req, 'id'), body.status, {
    ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
    ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
  });
  return ok(res, job, 'Job status updated');
};

export const submitProof = async (req: Request, res: Response) => {
  const user = requireUser(req);
  // Multipart fields arrive as strings, so validate here rather than in
  // middleware that runs before multer has parsed the body.
  const input = submitProofSchema.parse(req.body);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  const proof = await service.submitProof(user.id, param(req, 'id'), files, {
    ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
    ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    customerConfirmed: input.customerConfirmed,
  });

  return created(res, proof, 'Proof of collection uploaded');
};

export const failJob = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const job = await service.failJob(user.id, param(req, 'id'), req.body as never);
  return ok(res, job, 'Collection marked as failed');
};

export const ping = async (req: Request, res: Response) => {
  const user = requireUser(req);
  await service.recordLocation(user.id, req.body as never);
  return ok(res, null, 'Location updated');
};

export const setAvailability = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { availabilityStatus } = req.body as { availabilityStatus: never };
  return ok(res, await service.setAvailability(user.id, availabilityStatus), 'Availability updated');
};
