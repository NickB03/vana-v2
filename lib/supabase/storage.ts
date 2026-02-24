import { createClient } from './server'

export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'user-uploads'

export async function uploadFileToSupabase(
  file: File,
  userId: string,
  chatId: string
) {
  const supabase = await createClient()
  const sanitizedFileName = file.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
  const filePath = `${userId}/chats/${chatId}/${Date.now()}-${sanitizedFileName}`

  try {
    const buffer = await file.arrayBuffer()
    
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      throw error
    }

    const { data: { publicUrl } } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return {
      filename: file.name,
      url: publicUrl,
      mediaType: file.type,
      type: 'file'
    }
  } catch (error: any) {
    console.error('Supabase Upload Error:', error)
    throw new Error('Upload failed: ' + error.message)
  }
}
