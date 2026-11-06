import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../hooks/useAuth';
import {
  createHousehold,
  deleteHousehold,
  renameHousehold,
  subscribeToHouseholds,
} from '../services/households';
import type { Household } from '../types/household';

// Näyttää kotitaloudet reaaliaikaisesti ja mahdollistaa luonnin,
// omistajan tekemän nimen muokkauksen sekä kotitalouden poistamisen.
export default function HouseholdsScreen() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;

  const [name, setName] = useState('');
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [editingHousehold, setEditingHousehold] =
    useState<Household | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editError, setEditError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deletionInProgress = useRef(false);

  const isCreateDisabled = isCreating || !user || !name.trim();
  const isRenameDisabled = isRenaming || !editedName.trim();

  useEffect(() => {
    setHouseholds([]);
    setLoadError('');

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    return subscribeToHouseholds(
      userId,
      (updatedHouseholds) => {
        setHouseholds(updatedHouseholds);
        setLoading(false);
        setLoadError('');
      },
      (error) => {
        setHouseholds([]);
        setLoading(false);
        setLoadError(`Households loading failed (${error.code}).`);
      },
    );
  }, [userId]);

  // Luo kotitalouden ja tyhjentää lomakkeen onnistumisen jälkeen.
  const handleCreate = async () => {
    if (isCreateDisabled) return;

    setFormError('');
    setSuccessMessage('');
    setIsCreating(true);

    try {
      await createHousehold(name);

      setName('');
      setSuccessMessage('Household created.');
    } catch (error) {
      if (error instanceof FirebaseError) {
        setFormError(`Household creation failed (${error.code}).`);
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Avaa muokkauksen valitun kotitalouden nykyisellä nimellä.
  const openEdit = (household: Household) => {
    if (
      household.ownerId !== userId ||
      household.isDeleting ||
      deletionInProgress.current
    ) {
      return;
    }

    setEditingHousehold(household);
    setEditedName(household.name);
    setEditError('');
  };

  // Sulkee muokkauksen, kun tallennus ei ole kesken.
  const closeEdit = () => {
    if (isRenaming) return;

    setEditingHousehold(null);
    setEditedName('');
    setEditError('');
  };

  // Tallentaa uuden nimen ja sulkee overlayn onnistumisen jälkeen.
  const handleRename = async () => {
    if (!editingHousehold || isRenameDisabled) return;

    setEditError('');
    setIsRenaming(true);

    try {
      await renameHousehold(editingHousehold.id, editedName);

      setEditingHousehold(null);
      setEditedName('');
    } catch (error) {
      if (error instanceof FirebaseError) {
        setEditError(`Renaming failed (${error.code}).`);
      } else if (error instanceof Error) {
        setEditError(error.message);
      } else {
        setEditError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsRenaming(false);
    }
  };

  // Poistaa kotitalouden ja näyttää virheen, jos poisto ei valmistu.
  const handleDelete = async (householdId: string) => {
    if (deletionInProgress.current) return;

    deletionInProgress.current = true;
    setDeletingId(householdId);
    setDeleteError('');

    try {
      await deleteHousehold(householdId);
    } catch (error) {
      let message = 'An unexpected error occurred.';

      if (error instanceof FirebaseError) {
        message = `Deletion failed (${error.code}).`;
      } else if (error instanceof Error) {
        message = error.message;
      }

      setDeleteError(
        `${message} Please try again. If deletion has started, choose Continue deletion.`,
      );
    } finally {
      deletionInProgress.current = false;
      setDeletingId(null);
    }
  };

  // Pyytää vahvistuksen ennen kotitalouden ja sen lemmikkien poistamista.
  const confirmDelete = (household: Household) => {
    if (
      household.ownerId !== userId ||
      deletionInProgress.current
    ) {
      return;
    }

    const continuing = household.isDeleting === true;

    Alert.alert(
      continuing ? 'Continue deletion?' : 'Delete household?',
      continuing
        ? `Continue deleting "${household.name}" and its remaining pets? This cannot be undone.`
        : `Delete "${household.name}" and ALL its pets for every member? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: continuing ? 'Continue deletion' : 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDelete(household.id);
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Households</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>Create Household</Text>

          <Text style={styles.text}>Household Name</Text>

          <TextInput
            style={styles.input}
            accessibilityLabel="Household Name"
            placeholder="For example, Home"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!isCreating}
          />

          {formError !== '' && (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          )}

          {successMessage !== '' && (
            <Text style={styles.success}>{successMessage}</Text>
          )}

          <Pressable
            onPress={handleCreate}
            disabled={isCreateDisabled}
            accessibilityRole="button"
            accessibilityState={{
              disabled: isCreateDisabled,
              busy: isCreating,
            }}
            style={({ pressed }) => [
              styles.createButton,
              isCreateDisabled
                ? styles.createButtonDisabled
                : pressed
                  ? styles.createButtonPressed
                  : styles.createButtonEnabled,
            ]}
          >
            <Text style={styles.createButtonText}>
              {isCreating ? 'Creating…' : 'Create Household'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.heading}>Your Households</Text>

        {(authLoading || loading) && (
          <ActivityIndicator size="large" color="#2563EB" />
        )}

        {loadError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {loadError}
          </Text>
        )}

        {!authLoading &&
          !loading &&
          !loadError &&
          households.length === 0 && (
            <Text style={styles.text}>
              You don't have any households yet.
            </Text>
          )}

        {deleteError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {deleteError}
          </Text>
        )}

        {households.map((household) => (
          <View key={household.id} style={styles.card}>
            <Text style={styles.heading}>{household.name}</Text>

            <Text style={styles.text}>
              Members: {household.memberIds.length}
            </Text>

            {household.ownerId === userId && (
              <Text style={styles.text}>
                You are the owner of this household.
              </Text>
            )}

            {household.isDeleting ? (
              <Text style={styles.error}>
                Deletion has started. This household can no longer be
                edited or receive new pets.
              </Text>
            ) : household.joinCode ? (
              <View style={styles.joinCodeContainer}>
                <Text style={styles.text}>Join code</Text>

                <Text selectable style={styles.joinCode}>
                  {household.joinCode}
                </Text>

                <Text style={styles.text}>
                  Share this code with someone you want to join your
                  household.
                </Text>
              </View>
            ) : (
              <Text style={styles.text}>
                This household does not have a join code yet.
              </Text>
            )}

            {household.ownerId === userId && (
              <View style={styles.cardActions}>
                {!household.isDeleting && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit household ${household.name}`}
                    accessibilityState={{
                      disabled: deletingId !== null,
                    }}
                    disabled={deletingId !== null}
                    onPress={() => openEdit(household)}
                    style={({ pressed }) => [
                      styles.createButton,
                      deletingId !== null
                        ? styles.createButtonDisabled
                        : pressed
                          ? styles.createButtonPressed
                          : styles.createButtonEnabled,
                    ]}
                  >
                    <Text style={styles.createButtonText}>Edit</Text>
                  </Pressable>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    household.isDeleting
                      ? `Continue deleting household ${household.name}`
                      : `Delete household ${household.name}`
                  }
                  accessibilityState={{
                    disabled: deletingId !== null,
                    busy: deletingId === household.id,
                  }}
                  disabled={deletingId !== null}
                  onPress={() => confirmDelete(household)}
                  style={({ pressed }) => [
                    styles.createButton,
                    deletingId !== null
                      ? styles.createButtonDisabled
                      : pressed
                        ? styles.deleteButtonPressed
                        : styles.deleteButton,
                  ]}
                >
                  <Text style={styles.createButtonText}>
                    {deletingId === household.id
                      ? 'Deleting…'
                      : household.isDeleting
                        ? 'Continue deletion'
                        : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={editingHousehold !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard} accessibilityViewIsModal>
              <Text style={styles.heading}>Edit household</Text>

              <Text style={styles.text}>Household name</Text>

              <TextInput
                style={styles.input}
                accessibilityLabel="Household name"
                value={editedName}
                onChangeText={setEditedName}
                maxLength={80}
                editable={!isRenaming}
                autoCapitalize="sentences"
              />

              {editError !== '' && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {editError}
                </Text>
              )}

              <Pressable
                onPress={handleRename}
                disabled={isRenameDisabled}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isRenameDisabled,
                  busy: isRenaming,
                }}
                style={({ pressed }) => [
                  styles.createButton,
                  isRenameDisabled
                    ? styles.createButtonDisabled
                    : pressed
                      ? styles.createButtonPressed
                      : styles.createButtonEnabled,
                ]}
              >
                <Text style={styles.createButtonText}>
                  {isRenaming ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>

              <Pressable
                onPress={closeEdit}
                disabled={isRenaming}
                accessibilityRole="button"
                accessibilityState={{ disabled: isRenaming }}
                style={({ pressed }) => [
                  styles.cancelButton,
                  (pressed || isRenaming) && styles.dimmedButton,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  content: {
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  text: {
    fontSize: 16,
    color: '#374151',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  cardActions: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  error: {
    color: '#B91C1C',
  },
  success: {
    color: '#15803D',
  },
  createButton: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonEnabled: {
    backgroundColor: '#2563EB',
  },
  createButtonPressed: {
    backgroundColor: '#1D4ED8',
  },
  createButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#B91C1C',
  },
  deleteButtonPressed: {
    backgroundColor: '#991B1B',
  },
  joinCodeContainer: {
    gap: 8,
  },
  joinCode: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#2563EB',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  cancelButton: {
    minHeight: 48,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  dimmedButton: {
    opacity: 0.5,
  },
});