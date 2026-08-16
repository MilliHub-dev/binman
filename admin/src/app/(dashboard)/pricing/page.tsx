'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPricingRule,
  listPricingRules,
  listServiceAreas,
  updatePricingRule,
} from '@/lib/admin';
import { naira } from '@/lib/format';
import { ApiError } from '@/lib/api';
import {
  Button,
  Card,
  EmptyRow,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  TableShell,
  Td,
  Th,
} from '@/components/ui';

const WASTE_TYPES = ['HOUSEHOLD', 'FOOD', 'PLASTIC', 'PAPER', 'CARDBOARD', 'MIXED', 'GARDEN', 'COMMERCIAL', 'OTHER'];
const SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'];
const CLEANING_TYPES = ['REGULAR', 'DEEP', 'OFFICE', 'MOVE_IN', 'MOVE_OUT', 'POST_EVENT'];
const PROPERTY_SIZES = ['ONE_BEDROOM', 'TWO_BEDROOM', 'THREE_BEDROOM', 'FOUR_PLUS_BEDROOM'];

const pretty = (value: string | null) =>
  value ? value.toLowerCase().replace(/_/g, ' ') : 'Any';

/**
 * Pricing (admin.md §6).
 *
 * These rules ARE the prices — the apps never hardcode one (prd.md §12), so an
 * unpriced combination means customers simply cannot book it. Rules use null as
 * a wildcard and the most specific match wins.
 */
export default function PricingPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({
    serviceType: 'WASTE_COLLECTION',
    wasteType: '',
    collectionSize: 'MEDIUM',
    cleaningType: 'REGULAR',
    propertySize: 'TWO_BEDROOM',
    serviceAreaId: '',
    basePrice: '',
    serviceFee: '500',
  });

  const rules = useQuery({ queryKey: ['pricing'], queryFn: listPricingRules });
  const areas = useQuery({ queryKey: ['areas'], queryFn: listServiceAreas });

  const isWaste = form.serviceType === 'WASTE_COLLECTION';

  const add = useMutation({
    mutationFn: () =>
      createPricingRule({
        serviceType: form.serviceType,
        ...(isWaste
          ? {
              wasteType: form.wasteType || null,
              collectionSize: form.collectionSize,
            }
          : {
              cleaningType: form.cleaningType,
              propertySize: form.propertySize,
            }),
        serviceAreaId: form.serviceAreaId || null,
        // Entered in naira; the API stores kobo.
        basePrice: Math.round(Number(form.basePrice) * 100),
        serviceFee: Math.round(Number(form.serviceFee || 0) * 100),
      }),
    onSuccess: () => {
      setAdding(false);
      setError(undefined);
      void client.invalidateQueries({ queryKey: ['pricing'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create rule.'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updatePricingRule(id, { isActive }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['pricing'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update rule.'),
  });

  const areaName = (id: string | null) =>
    id ? (areas.data ?? []).find((area) => area.id === id)?.name ?? 'Unknown area' : 'All areas';

  const list = rules.data ?? [];

  return (
    <>
      <PageHeader
        title="Pricing"
        subtitle="What customers are charged. Nothing is hardcoded in the apps."
        action={<Button onClick={() => setAdding(true)}>Add rule</Button>}
      />

      {list.length === 0 && !rules.isLoading ? (
        <Card className="mb-5 border-warn/40 bg-warn-bg">
          <p className="font-semibold text-warn-fg">No pricing rules configured</p>
          <p className="mt-1 text-sm text-warn-fg">
            Until at least one rule exists, every booking attempt fails with
            NO_PRICE_CONFIGURED and no customer can check out.
          </p>
        </Card>
      ) : null}

      {rules.error ? (
        <div className="mb-5">
          <ErrorNote error={rules.error} onRetry={rules.refetch} />
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-fg">{error}</div>
      ) : null}

      <TableShell>
        <thead>
          <tr>
            <Th>Service</Th>
            <Th>Applies to</Th>
            <Th>Size</Th>
            <Th>Area</Th>
            <Th right>Base price</Th>
            <Th right>Service fee</Th>
            <Th>Status</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rules.isLoading ? (
            <Skeleton rows={7} cols={8} />
          ) : list.length === 0 ? (
            <EmptyRow colSpan={8} message="No pricing rules yet." />
          ) : (
            list.map((rule) => (
              <tr key={rule.id} className="hover:bg-ink-50">
                <Td className="whitespace-nowrap font-medium">
                  {rule.serviceType === 'WASTE_COLLECTION' ? 'Waste' : 'Cleaning'}
                </Td>
                <Td className="capitalize text-ink-600">
                  {pretty(rule.wasteType ?? rule.cleaningType)}
                </Td>
                <Td className="capitalize text-ink-600">
                  {pretty(rule.collectionSize ?? rule.propertySize)}
                </Td>
                <Td className="text-ink-600">{areaName(rule.serviceAreaId)}</Td>
                <Td right className="nums font-semibold">
                  {naira(rule.basePrice)}
                </Td>
                <Td right className="nums text-ink-600">
                  {rule.serviceFee > 0 ? naira(rule.serviceFee) : 'default'}
                </Td>
                <Td>
                  <StatusPill
                    status={rule.isActive ? 'ACTIVE' : 'OFFLINE'}
                    label={rule.isActive ? 'Live' : 'Off'}
                  />
                </Td>
                <Td right>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: rule.id, isActive: !rule.isActive })}
                  >
                    {rule.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Modal open={adding} title="Add pricing rule" onClose={() => setAdding(false)}>
        <div className="space-y-3">
          <Field label="Service">
            <Select
              value={form.serviceType}
              onChange={(event) => setForm({ ...form, serviceType: event.target.value })}
            >
              <option value="WASTE_COLLECTION">Waste collection</option>
              <option value="CLEANING">Cleaning</option>
            </Select>
          </Field>

          {isWaste ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Waste type" hint="Leave as Any to cover every type.">
                <Select
                  value={form.wasteType}
                  onChange={(event) => setForm({ ...form, wasteType: event.target.value })}
                >
                  <option value="">Any type</option>
                  {WASTE_TYPES.map((type) => (
                    <option key={type} value={type} className="capitalize">
                      {type.toLowerCase().replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Size">
                <Select
                  value={form.collectionSize}
                  onChange={(event) => setForm({ ...form, collectionSize: event.target.value })}
                >
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size.toLowerCase().replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cleaning type">
                <Select
                  value={form.cleaningType}
                  onChange={(event) => setForm({ ...form, cleaningType: event.target.value })}
                >
                  {CLEANING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.toLowerCase().replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Property size">
                <Select
                  value={form.propertySize}
                  onChange={(event) => setForm({ ...form, propertySize: event.target.value })}
                >
                  {PROPERTY_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size.toLowerCase().replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <Field label="Area" hint="Area-specific rules beat nationwide ones.">
            <Select
              value={form.serviceAreaId}
              onChange={(event) => setForm({ ...form, serviceAreaId: event.target.value })}
            >
              <option value="">All areas</option>
              {(areas.data ?? []).map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Base price (₦)">
              <Input
                type="number"
                min={0}
                value={form.basePrice}
                onChange={(event) => setForm({ ...form, basePrice: event.target.value })}
                placeholder="2500"
              />
            </Field>
            <Field label="Service fee (₦)" hint="0 uses the platform default.">
              <Input
                type="number"
                min={0}
                value={form.serviceFee}
                onChange={(event) => setForm({ ...form, serviceFee: event.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <Button
            disabled={!form.basePrice || Number(form.basePrice) <= 0 || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? 'Saving…' : 'Create rule'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
