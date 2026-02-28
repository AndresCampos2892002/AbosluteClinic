package com.example.farmacia_backend.auth;

import com.example.farmacia_backend.users.UserEntity;
import com.example.farmacia_backend.users.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Carga usuarios desde la tabla "usuarios".
 * Se usa automáticamente por AuthenticationManager.
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository repo;

    public UserDetailsServiceImpl(UserRepository repo) {
        this.repo = repo;
    }

    @Override
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {

        UserEntity u = repo.findByUsuarioIgnoreCaseOrCorreoIgnoreCase(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));

        return User.builder()
                .username(u.getUsuario())
                .password(u.getContrasena())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + u.getRol().name())))
                .build();
    }
}