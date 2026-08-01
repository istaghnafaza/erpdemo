import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  fetchDistricts,
  fetchProvinces,
  fetchRegencies,
  fetchVillages,
  type WilayahItem,
} from "@/lib/indonesia-wilayah";

export interface OwnerAddressValue {
  provinceCode: string;
  provinceName: string;
  regencyCode: string;
  regencyName: string;
  districtCode: string;
  districtName: string;
  villageCode: string;
  villageName: string;
  street: string;
}

export const EMPTY_OWNER_ADDRESS: OwnerAddressValue = {
  provinceCode: "",
  provinceName: "",
  regencyCode: "",
  regencyName: "",
  districtCode: "",
  districtName: "",
  villageCode: "",
  villageName: "",
  street: "",
};

interface IndonesiaAddressFieldsProps {
  value: OwnerAddressValue;
  onChange: (value: OwnerAddressValue) => void;
  errors?: Partial<Record<keyof OwnerAddressValue | "address", string>>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

function toOptions(items: WilayahItem[]) {
  return items.map((item) => ({ value: item.code, label: item.name }));
}

export function IndonesiaAddressFields({ value, onChange, errors }: IndonesiaAddressFieldsProps) {
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);
  const [loading, setLoading] = useState({
    provinces: false,
    regencies: false,
    districts: false,
    villages: false,
  });

  useEffect(() => {
    setLoading((s) => ({ ...s, provinces: true }));
    void fetchProvinces()
      .then(setProvinces)
      .catch(() => setProvinces([]))
      .finally(() => setLoading((s) => ({ ...s, provinces: false })));
  }, []);

  useEffect(() => {
    if (!value.provinceCode) {
      setRegencies([]);
      return;
    }
    setLoading((s) => ({ ...s, regencies: true }));
    void fetchRegencies(value.provinceCode)
      .then(setRegencies)
      .catch(() => setRegencies([]))
      .finally(() => setLoading((s) => ({ ...s, regencies: false })));
  }, [value.provinceCode]);

  useEffect(() => {
    if (!value.regencyCode) {
      setDistricts([]);
      return;
    }
    setLoading((s) => ({ ...s, districts: true }));
    void fetchDistricts(value.regencyCode)
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setLoading((s) => ({ ...s, districts: false })));
  }, [value.regencyCode]);

  useEffect(() => {
    if (!value.districtCode) {
      setVillages([]);
      return;
    }
    setLoading((s) => ({ ...s, villages: true }));
    void fetchVillages(value.districtCode)
      .then(setVillages)
      .catch(() => setVillages([]))
      .finally(() => setLoading((s) => ({ ...s, villages: false })));
  }, [value.districtCode]);

  const allWilayahSelected =
    value.provinceCode && value.regencyCode && value.districtCode && value.villageCode;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Alamat Owner</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ketik untuk mencari — pilih provinsi hingga kelurahan, lalu isi nama jalan
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>
            Provinsi <span className="text-destructive">*</span>
          </Label>
          <SearchableCombobox
            value={value.provinceCode}
            options={toOptions(provinces)}
            placeholder={loading.provinces ? "Memuat..." : "Pilih provinsi"}
            searchPlaceholder="Ketik nama provinsi..."
            disabled={loading.provinces}
            onChange={(code, option) => {
              onChange({
                ...EMPTY_OWNER_ADDRESS,
                provinceCode: code,
                provinceName: option?.label ?? "",
              });
            }}
          />
          <FieldError message={errors?.provinceCode} />
        </div>

        <div className="space-y-1.5">
          <Label>
            Kota/Kabupaten <span className="text-destructive">*</span>
          </Label>
          <SearchableCombobox
            value={value.regencyCode}
            options={toOptions(regencies)}
            placeholder={loading.regencies ? "Memuat..." : "Pilih kota/kabupaten"}
            searchPlaceholder="Ketik kota/kabupaten..."
            disabled={!value.provinceCode || loading.regencies}
            onChange={(code, option) => {
              onChange({
                ...value,
                regencyCode: code,
                regencyName: option?.label ?? "",
                districtCode: "",
                districtName: "",
                villageCode: "",
                villageName: "",
              });
            }}
          />
          <FieldError message={errors?.regencyCode} />
        </div>

        <div className="space-y-1.5">
          <Label>
            Kecamatan <span className="text-destructive">*</span>
          </Label>
          <SearchableCombobox
            value={value.districtCode}
            options={toOptions(districts)}
            placeholder={loading.districts ? "Memuat..." : "Pilih kecamatan"}
            searchPlaceholder="Ketik kecamatan..."
            disabled={!value.regencyCode || loading.districts}
            onChange={(code, option) => {
              onChange({
                ...value,
                districtCode: code,
                districtName: option?.label ?? "",
                villageCode: "",
                villageName: "",
              });
            }}
          />
          <FieldError message={errors?.districtCode} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>
            Kelurahan/Desa <span className="text-destructive">*</span>
          </Label>
          <SearchableCombobox
            value={value.villageCode}
            options={toOptions(villages)}
            placeholder={loading.villages ? "Memuat..." : "Pilih kelurahan/desa"}
            searchPlaceholder="Ketik kelurahan/desa..."
            disabled={!value.districtCode || loading.villages}
            onChange={(code, option) => {
              onChange({
                ...value,
                villageCode: code,
                villageName: option?.label ?? "",
              });
            }}
          />
          <FieldError message={errors?.villageCode} />
        </div>

        {allWilayahSelected ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="owner-street">
              Nama Jalan / Detail Alamat <span className="text-destructive">*</span>
            </Label>
            <Input
              id="owner-street"
              value={value.street}
              onChange={(e) => onChange({ ...value, street: e.target.value })}
              placeholder="Contoh: Jl. Merdeka No. 12, RT 03/RW 05"
              autoComplete="street-address"
            />
            <FieldError message={errors?.street} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
