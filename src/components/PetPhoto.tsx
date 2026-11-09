import { useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirebaseError } from 'firebase/app';
import { choosePetPhoto, saveCroppedPetPhoto, type SelectedPhoto, type SquareCrop } from '../services/petPhotos';
import type { Pet } from '../types/pet';

type Props = {
  pet: Pet;
  editable?: boolean;
};

type CropModalProps = {
  photo: SelectedPhoto;
  petId: string;
  onClose: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Näyttää tallennetun kuvan ja avaa hallintanäkymästä kuvavalitsimen.
export default function PetPhoto({ pet, editable = false }: Props) {
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState('');
  const choosingInProgress = useRef(false);

  const photoUri = useMemo(() => {
    if (!pet.photo) return null;
    return `data:image/jpeg;base64,${pet.photo.toBase64()}`;
  }, [pet.photo]);

  const handleChoose = async () => {
    if (!editable || choosingInProgress.current) return;

    choosingInProgress.current = true;
    setIsChoosing(true);
    setError('');

    try {
      const selected = await choosePetPhoto();
      if (selected) setSelectedPhoto(selected);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open the photo.');
    } finally {
      choosingInProgress.current = false;
      setIsChoosing(false);
    }
  };

  if (!photoUri && !editable) return null;

  return (
    <View style={styles.container}>
      {photoUri && (
        <Image
          source={{ uri: photoUri }}
          style={styles.cardPhoto}
          resizeMode="contain"
          accessible
          accessibilityLabel={`Photo of ${pet.name}`}
        />
      )}

      {editable && (
        <Pressable
          onPress={handleChoose}
          disabled={isChoosing}
          accessibilityRole="button"
          accessibilityLabel={`${pet.photo ? 'Change' : 'Add'} photo of ${pet.name}`}
          style={({ pressed }) => [
            styles.button,
            styles.secondaryButton,
            (pressed || isChoosing) && styles.dimmed,
          ]}
        >
          <Text style={styles.secondaryText}>
            {isChoosing ? 'Opening…' : pet.photo ? 'Change photo' : 'Add photo'}
          </Text>
        </Pressable>
      )}

      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      )}

      {editable && selectedPhoto && (
        <CropModal
          photo={selectedPhoto}
          petId={pet.id}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </View>
  );
}

// Näyttää tallentuvan neliörajauksen ja pitää painikkeet kuvan ulkopuolella.
function CropModal({ photo, petId, onClose }: CropModalProps) {
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({
    x: photo.width / 2,
    y: photo.height / 2,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const savingInProgress = useRef(false);
  const dragStart = useRef({ pageX: 0, pageY: 0, centerX: 0, centerY: 0 });

  const frame = Math.floor(Math.min(available.width, available.height, 480));
  const size = Math.max(1, Math.floor(Math.min(photo.width, photo.height) / zoom));

  const crop: SquareCrop = {
    originX: clamp(Math.round(center.x - size / 2), 0, photo.width - size),
    originY: clamp(Math.round(center.y - size / 2), 0, photo.height - size),
    size,
  };

  const scale = frame / size;

  const handleSave = async () => {
    if (savingInProgress.current || frame <= 0) return;

    savingInProgress.current = true;
    setIsSaving(true);
    setError('');

    try {
      await saveCroppedPetPhoto(petId, photo, crop);
      onClose();
    } catch (error) {
      if (error instanceof FirebaseError) {
        setError(`Photo could not be saved (${error.code}).`);
      } else {
        setError(error instanceof Error ? error.message : 'Could not save the photo.');
      }
    } finally {
      savingInProgress.current = false;
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!savingInProgress.current) onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.modal}>
        <Text style={styles.title}>Crop photo</Text>
        <Text style={styles.hint}>Drag the photo to position your pet in the square.</Text>

        <View
          style={styles.previewArea}
          onLayout={({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            setAvailable({ width, height });
          }}
        >
          {frame > 0 && (
            <View
              style={[styles.frame, { width: frame, height: frame }]}
              onStartShouldSetResponder={() => !isSaving}
              onResponderGrant={({ nativeEvent }) => {
                dragStart.current = {
                  pageX: nativeEvent.pageX,
                  pageY: nativeEvent.pageY,
                  centerX: crop.originX + size / 2,
                  centerY: crop.originY + size / 2,
                };
              }}
              onResponderMove={({ nativeEvent }) => {
                const start = dragStart.current;
                const dx = (nativeEvent.pageX - start.pageX) / scale;
                const dy = (nativeEvent.pageY - start.pageY) / scale;

                setCenter({
                  x: clamp(start.centerX - dx, size / 2, photo.width - size / 2),
                  y: clamp(start.centerY - dy, size / 2, photo.height - size / 2),
                });
              }}
            >
              <Image
                source={{ uri: photo.uri }}
                resizeMode="stretch"
                accessible={false}
                style={{
                  position: 'absolute',
                  width: photo.width * scale,
                  height: photo.height * scale,
                  left: -crop.originX * scale,
                  top: -crop.originY * scale,
                }}
              />
            </View>
          )}
        </View>

        <View style={styles.zoomRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            disabled={isSaving || zoom <= 1}
            onPress={() => setZoom((value) => Math.max(1, value - 0.5))}
            style={[styles.button, styles.secondaryButton, zoom <= 1 && styles.dimmed]}
          >
            <Text style={styles.secondaryText}>−</Text>
          </Pressable>

          <Text style={styles.zoomLabel}>{zoom}×</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            disabled={isSaving || zoom >= 4}
            onPress={() => setZoom((value) => Math.min(4, value + 0.5))}
            style={[styles.button, styles.secondaryButton, zoom >= 4 && styles.dimmed]}
          >
            <Text style={styles.secondaryText}>+</Text>
          </Pressable>
        </View>

        {error !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.button, styles.secondaryButton, styles.action,
              (pressed || isSaving) && styles.dimmed,
            ]}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving || frame <= 0}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.button, styles.primaryButton, styles.action,
              (pressed || isSaving || frame <= 0) && styles.dimmed,
            ]}
          >
            <Text style={styles.primaryText}>
              {isSaving ? 'Saving…' : 'Save photo'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  cardPhoto: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 10,
  },
  modal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 16, color: '#374151' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { overflow: 'hidden', backgroundColor: '#111827' },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  zoomLabel: { minWidth: 40, textAlign: 'center', color: '#111827' },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  primaryButton: { backgroundColor: '#2563EB' },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2563EB',
    borderWidth: 1,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#1D4ED8', fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.5 },
  error: { color: '#B91C1C' },
});